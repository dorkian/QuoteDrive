"""Summary fields for opportunity and customer lists.

Computed per request from tenant-scoped rows (three small queries), so the
tables and detail panels can show owner, value and recent activity without the
browser fetching every proposal version.
"""

from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    Customer,
    Opportunity,
    ProposalVersion,
    ProposalVersionStatus,
    User,
)
from app.schemas.customer import CustomerOut
from app.schemas.opportunity import LatestVersionOut, OpportunityOut

_DEAD = {ProposalVersionStatus.EXPIRED, ProposalVersionStatus.LOST, ProposalVersionStatus.WON}


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _versions_by_opportunity(
    db: Session, org_id: int, opportunity_ids: Sequence[int]
) -> dict[int, list[ProposalVersion]]:
    if not opportunity_ids:
        return {}
    rows = db.execute(
        select(ProposalVersion).where(
            ProposalVersion.organization_id == org_id,
            ProposalVersion.opportunity_id.in_(opportunity_ids),
        )
    ).scalars()
    grouped: dict[int, list[ProposalVersion]] = defaultdict(list)
    for version in rows:
        grouped[version.opportunity_id].append(version)
    return grouped


def summarize_opportunities(
    db: Session, org_id: int, opportunities: Sequence[Opportunity]
) -> list[OpportunityOut]:
    ids = [o.id for o in opportunities]
    versions = _versions_by_opportunity(db, org_id, ids)
    owners = {
        u.id: u.display_name
        for u in db.execute(
            select(User).where(User.id.in_({o.owner_id for o in opportunities}))
        ).scalars()
    }

    version_owner = {v.id: opp_id for opp_id, vs in versions.items() for v in vs}
    last_seen: dict[int, datetime] = {}
    if ids:
        events = db.execute(
            select(AuditEvent.entity_type, AuditEvent.entity_id, AuditEvent.created_at).where(
                AuditEvent.organization_id == org_id,
                AuditEvent.entity_type.in_(["opportunity", "proposal_version"]),
            )
        ).all()
        for entity_type, entity_id, created in events:
            opp_id = entity_id if entity_type == "opportunity" else version_owner.get(entity_id)
            if opp_id is None or opp_id not in ids:
                continue
            stamp = _aware(created)
            if opp_id not in last_seen or stamp > last_seen[opp_id]:
                last_seen[opp_id] = stamp

    result: list[OpportunityOut] = []
    for opp in opportunities:
        mine = versions.get(opp.id, [])
        latest = max(mine, key=lambda v: v.version_number, default=None)
        out = OpportunityOut.model_validate(opp, from_attributes=True)
        out.owner_name = owners.get(opp.owner_id)
        out.version_count = len(mine)
        out.latest_version = (
            LatestVersionOut(
                id=latest.id,
                version_number=latest.version_number,
                status=latest.status.value,
                total_estimate=latest.total_estimate,
            )
            if latest
            else None
        )
        out.last_activity_at = last_seen.get(opp.id) or (
            _aware(opp.created_at) if opp.created_at else None
        )
        result.append(out)
    return result


def summarize_customers(
    db: Session, org_id: int, customers: Sequence[Customer]
) -> list[CustomerOut]:
    ids = [c.id for c in customers]
    opportunities = (
        list(
            db.execute(
                select(Opportunity).where(
                    Opportunity.organization_id == org_id, Opportunity.customer_id.in_(ids)
                )
            ).scalars()
        )
        if ids
        else []
    )
    versions = _versions_by_opportunity(db, org_id, [o.id for o in opportunities])
    count: dict[int, int] = defaultdict(int)
    open_count: dict[int, int] = defaultdict(int)
    pipeline: dict[int, Decimal] = defaultdict(Decimal)
    for opp in opportunities:
        count[opp.customer_id] += 1
        if opp.status != "open":
            continue
        open_count[opp.customer_id] += 1
        latest = max(versions.get(opp.id, []), key=lambda v: v.version_number, default=None)
        if latest is not None and latest.status not in _DEAD:
            pipeline[opp.customer_id] += latest.total_estimate

    result: list[CustomerOut] = []
    for customer in customers:
        out = CustomerOut.model_validate(customer, from_attributes=True)
        out.opportunity_count = count[customer.id]
        out.open_opportunities = open_count[customer.id]
        out.open_pipeline_value = pipeline[customer.id]
        result.append(out)
    return result
