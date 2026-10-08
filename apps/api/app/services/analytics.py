"""Read-only dashboard analytics, computed in Python from tenant-scoped rows.

Volumes are small (one tenant's proposals), and aggregating here keeps the
queries portable across Postgres and the SQLite used by the tests.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from statistics import median
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    ApprovalRequest,
    ApprovalRequestStatus,
    GenerationLog,
    Opportunity,
    ProposalVersion,
    ProposalVersionStatus,
)
from app.schemas.dashboard import (
    AiStat,
    AnalyticsKpis,
    DashboardAnalytics,
    PackageStat,
    StageStat,
    WeeklyPoint,
)

RangeKey = Literal["4w", "12w", "all"]
_RANGE_WEEKS: dict[str, int | None] = {"4w": 4, "12w": 12, "all": None}
_MAX_WEEKS = 52


@dataclass
class _Week:
    opportunities: int = 0
    versions: int = 0
    value: Decimal = field(default_factory=lambda: Decimal(0))
    hours: list[float] = field(default_factory=list)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _week_start(value: datetime) -> date:
    day = _aware(value).date()
    return day - timedelta(days=day.weekday())


def _round1(value: float) -> float:
    return round(value, 1)


def build_analytics(
    db: Session, organization_id: int, range_key: RangeKey, now: datetime | None = None
) -> DashboardAnalytics:
    now = now or datetime.now(UTC)
    this_week = _week_start(now)

    opportunities = list(
        db.execute(select(Opportunity).where(Opportunity.organization_id == organization_id))
        .scalars()
        .all()
    )
    versions = list(
        db.execute(
            select(ProposalVersion).where(ProposalVersion.organization_id == organization_id)
        )
        .scalars()
        .all()
    )
    approvals = list(
        db.execute(
            select(ApprovalRequest).where(ApprovalRequest.organization_id == organization_id)
        )
        .scalars()
        .all()
    )
    logs = list(
        db.execute(select(GenerationLog).where(GenerationLog.organization_id == organization_id))
        .scalars()
        .all()
    )

    weeks = _RANGE_WEEKS[range_key]
    if weeks is None:
        stamps = [_aware(o.created_at) for o in opportunities] + [
            _aware(v.created_at) for v in versions
        ]
        first = _week_start(min(stamps)) if stamps else this_week
        weeks = min(max((this_week - first).days // 7 + 1, 1), _MAX_WEEKS)
    start_week = this_week - timedelta(weeks=weeks - 1)
    start = datetime.combine(start_week, datetime.min.time(), tzinfo=UTC)
    # "all" means all time for the totals; only the weekly chart is capped.
    unbounded = range_key == "all"

    def in_range(value: datetime | None) -> bool:
        return value is not None and (unbounded or _aware(value) >= start)

    # --- Stage snapshot (current state, not range-limited) ---
    stage_count: dict[str, int] = defaultdict(int)
    stage_value: dict[str, Decimal] = defaultdict(Decimal)
    for version in versions:
        stage_count[version.status.value] += 1
        stage_value[version.status.value] += version.total_estimate
    stages = [
        StageStat(
            status=status.value, count=stage_count[status.value], value=stage_value[status.value]
        )
        for status in ProposalVersionStatus
    ]

    # --- Open pipeline: the latest version of each open opportunity ---
    latest: dict[int, ProposalVersion] = {}
    for version in versions:
        current = latest.get(version.opportunity_id)
        if current is None or version.version_number > current.version_number:
            latest[version.opportunity_id] = version
    open_ids = {o.id for o in opportunities if o.status == "open"}
    dead = {ProposalVersionStatus.EXPIRED, ProposalVersionStatus.LOST, ProposalVersionStatus.WON}
    pipeline = sum(
        (
            latest[i].total_estimate
            for i in open_ids
            if i in latest and latest[i].status not in dead
        ),
        start=Decimal(0),
    )

    won = sum(1 for o in opportunities if o.status == "won")
    lost = sum(1 for o in opportunities if o.status == "lost")
    win_rate = _round1(won / (won + lost) * 100) if won + lost else None

    # --- Weekly buckets ---
    buckets = {start_week + timedelta(weeks=i): _Week() for i in range(weeks)}
    for opp in opportunities:
        if (week := buckets.get(_week_start(opp.created_at))) is not None:
            week.opportunities += 1
    for version in versions:
        if (week := buckets.get(_week_start(version.created_at))) is not None:
            week.versions += 1
            week.value += version.total_estimate
    decided_hours: list[float] = []
    for request in approvals:
        if request.status == ApprovalRequestStatus.PENDING or request.decision_at is None:
            continue
        hours = (_aware(request.decision_at) - _aware(request.created_at)).total_seconds() / 3600
        if (week := buckets.get(_week_start(request.decision_at))) is not None:
            week.hours.append(hours)
        if in_range(request.decision_at):
            decided_hours.append(hours)
    weekly = [
        WeeklyPoint(
            week_start=day,
            opportunities_created=w.opportunities,
            versions_created=w.versions,
            value_created=w.value,
            approvals_decided=len(w.hours),
            median_approval_hours=_round1(median(w.hours)) if w.hours else None,
        )
        for day, w in buckets.items()
    ]

    # --- Package mix over versions created in range ---
    pack: dict[tuple[str, str], list[Decimal | int]] = {}
    for version in versions:
        if not in_range(version.created_at):
            continue
        for line in version.content_json.get("lines", []):
            key = (str(line.get("name", "Unknown")), str(line.get("category", "")))
            entry = pack.setdefault(key, [0, Decimal(0)])
            entry[0] = int(entry[0]) + int(line.get("quantity", 0))
            entry[1] = Decimal(entry[1]) + Decimal(str(line.get("line_total", 0)))
    packages = sorted(
        (
            PackageStat(name=name, category=category, quantity=int(q), value=Decimal(v))
            for (name, category), (q, v) in pack.items()
        ),
        key=lambda p: p.value,
        reverse=True,
    )

    # --- AI health over generations in range ---
    grouped: dict[tuple[str, str], list[GenerationLog]] = defaultdict(list)
    for log in logs:
        if in_range(log.created_at):
            grouped[(log.provider, log.model)].append(log)
    ai = []
    for (provider, model), rows in sorted(grouped.items()):
        latencies = [r.latency_ms for r in rows if r.latency_ms is not None]
        ai.append(
            AiStat(
                provider=provider,
                model=model,
                total=len(rows),
                succeeded=sum(1 for r in rows if r.status == "success"),
                failed=sum(1 for r in rows if r.status != "success"),
                fallbacks=sum(1 for r in rows if r.fallback_reason),
                median_latency_ms=int(median(latencies)) if latencies else None,
            )
        )
    ai_total = sum(a.total for a in ai)
    ai_ok = sum(a.succeeded for a in ai)

    return DashboardAnalytics(
        range=range_key,
        kpis=AnalyticsKpis(
            open_pipeline_value=pipeline,
            open_opportunities=len(open_ids),
            win_rate=win_rate,
            won=won,
            lost=lost,
            awaiting_approval=stage_count[ProposalVersionStatus.AWAITING_APPROVAL.value],
            median_approval_hours=_round1(median(decided_hours)) if decided_hours else None,
            ai_success_rate=_round1(ai_ok / ai_total * 100) if ai_total else None,
            ai_generations=ai_total,
        ),
        stages=stages,
        weekly=weekly,
        packages=packages,
        ai=ai,
    )
