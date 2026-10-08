"""GET /dashboard/analytics: KPI maths, ranges, role access and tenant scoping."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    ApprovalRequest,
    ApprovalRequestStatus,
    GenerationLog,
    Opportunity,
    ProposalVersion,
    ProposalVersionStatus,
    User,
)
from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _days_ago(days: float) -> datetime:
    return datetime.now(UTC) - timedelta(days=days)


def _user_id(db: Session, email: str) -> int:
    return db.execute(select(User.id).where(User.email == email)).scalar_one()


def _line(name: str, category: str, quantity: int, total: str) -> dict[str, object]:
    return {"name": name, "category": category, "quantity": quantity, "line_total": total}


@pytest.fixture()
def seeded(db_session: Session, two_orgs: TwoOrgs) -> TwoOrgs:
    manager = _user_id(db_session, two_orgs.manager_a)
    approver = _user_id(db_session, two_orgs.approver_a)
    admin_b = _user_id(db_session, two_orgs.admin_b)

    def opp(
        org: int, customer: int, owner: int, title: str, status: str, age: float
    ) -> Opportunity:
        row = Opportunity(
            organization_id=org,
            customer_id=customer,
            owner_id=owner,
            title=title,
            status=status,
            created_at=_days_ago(age),
        )
        db_session.add(row)
        db_session.flush()
        return row

    def version(
        org: int,
        opportunity: Opportunity,
        number: int,
        status: ProposalVersionStatus,
        total: str,
        age: float,
        lines: list[dict[str, object]],
        creator: int,
    ) -> ProposalVersion:
        row = ProposalVersion(
            organization_id=org,
            opportunity_id=opportunity.id,
            version_number=number,
            status=status,
            total_estimate=Decimal(total),
            content_json={"lines": lines},
            created_by=creator,
            created_at=_days_ago(age),
        )
        db_session.add(row)
        db_session.flush()
        return row

    a, c = two_orgs.org_a_id, two_orgs.customer_a_id
    open_one = opp(a, c, manager, "Open one", "open", 3)
    open_two = opp(a, c, manager, "Open two", "open", 40)
    won_opp = opp(a, c, manager, "Won deal", "won", 20)
    lost_opp = opp(a, c, manager, "Lost deal", "lost", 18)

    # Open one: v1 superseded by v2, only the latest (v2) counts toward the pipeline.
    version(
        a,
        open_one,
        1,
        ProposalVersionStatus.CHANGES_REQUESTED,
        "1000.00",
        3,
        [_line("Electric City", "electric_city", 1, "1000.00")],
        manager,
    )
    v2 = version(
        a,
        open_one,
        2,
        ProposalVersionStatus.AWAITING_APPROVAL,
        "2000.00",
        2,
        [
            _line("Electric City", "electric_city", 2, "1298.00"),
            _line("Long Distance", "long_distance", 1, "702.00"),
        ],
        manager,
    )
    version(
        a,
        open_two,
        1,
        ProposalVersionStatus.DRAFT,
        "500.00",
        40,
        [_line("Hybrid Account Manager", "hybrid", 1, "500.00")],
        manager,
    )
    won_v = version(a, won_opp, 1, ProposalVersionStatus.WON, "3000.00", 20, [], manager)
    lost_v = version(a, lost_opp, 1, ProposalVersionStatus.LOST, "1500.00", 18, [], manager)

    for request_version, hours, age in ((won_v, 4, 15), (lost_v, 8, 18), (v2, 6, 1)):
        db_session.add(
            ApprovalRequest(
                organization_id=a,
                proposal_version_id=request_version.id,
                requested_by=manager,
                assigned_to=approver,
                status=ApprovalRequestStatus.APPROVED,
                created_at=_days_ago(age) - timedelta(hours=hours),
                decision_at=_days_ago(age),
            )
        )

    def log(provider: str, status: str, latency: int, fallback: str | None, age: float) -> None:
        db_session.add(
            GenerationLog(
                organization_id=a,
                actor_id=manager,
                actor_name="Manager",
                entity_type="proposal_version",
                entity_id=v2.id,
                provider=provider,
                model="m1",
                prompt_version="p1",
                latency_ms=latency,
                status=status,
                fallback_reason=fallback,
                created_at=_days_ago(age),
            )
        )

    log("ollama", "success", 1000, None, 2)
    log("ollama", "success", 3000, "primary_failed", 3)
    log("ollama", "error", 2000, None, 4)
    log("openrouter", "success", 500, None, 100)  # outside 4w and 12w, inside "all"

    # Another tenant's data must never leak in.
    other = opp(two_orgs.org_b_id, two_orgs.customer_b_id, admin_b, "Other tenant", "won", 1)
    version(
        two_orgs.org_b_id,
        other,
        1,
        ProposalVersionStatus.WON,
        "99999.00",
        1,
        [_line("Electric City", "electric_city", 99, "99999.00")],
        admin_b,
    )
    db_session.commit()
    return two_orgs


def test_requires_authentication(client: TestClient) -> None:
    assert client.get("/dashboard/analytics").status_code == 401


def test_invalid_range_is_rejected(
    client: TestClient, seeded: TwoOrgs, login: Callable[[str], str]
) -> None:
    response = client.get("/dashboard/analytics?range=7d", headers=_auth(login(seeded.manager_a)))
    assert response.status_code == 422


@pytest.mark.parametrize("who", ["admin_a", "manager_a", "approver_a", "viewer_a"])
def test_every_role_can_read(
    client: TestClient, seeded: TwoOrgs, login: Callable[[str], str], who: str
) -> None:
    response = client.get("/dashboard/analytics", headers=_auth(login(getattr(seeded, who))))
    assert response.status_code == 200


def test_kpis_use_latest_version_and_exclude_other_tenants(
    client: TestClient, seeded: TwoOrgs, login: Callable[[str], str]
) -> None:
    body = client.get(
        "/dashboard/analytics?range=12w", headers=_auth(login(seeded.manager_a))
    ).json()
    kpis = body["kpis"]

    # Open pipeline = latest version of each open opportunity: 2000 (v2) + 500 (v1).
    assert Decimal(kpis["open_pipeline_value"]) == Decimal("2500.00")
    assert kpis["open_opportunities"] == 2
    assert (kpis["won"], kpis["lost"], kpis["win_rate"]) == (1, 1, 50.0)
    assert kpis["awaiting_approval"] == 1
    # Decisions after 4h, 8h and 6h: the median is 6.
    assert kpis["median_approval_hours"] == 6.0
    # 2 of 3 in-window generations succeeded; the 100-day-old one is out of range.
    assert kpis["ai_generations"] == 3
    assert kpis["ai_success_rate"] == 66.7
    assert all("99999" not in str(value) for value in kpis.values())


def test_stage_snapshot_counts_every_status(
    client: TestClient, seeded: TwoOrgs, login: Callable[[str], str]
) -> None:
    stages = {
        s["status"]: s
        for s in client.get("/dashboard/analytics", headers=_auth(login(seeded.manager_a))).json()[
            "stages"
        ]
    }
    assert stages["awaiting_approval"]["count"] == 1
    assert Decimal(stages["won"]["value"]) == Decimal("3000.00")
    assert stages["shared"]["count"] == 0
    assert set(stages) == {s.value for s in ProposalVersionStatus}


def test_weekly_series_fills_every_week_and_respects_range(
    client: TestClient, seeded: TwoOrgs, login: Callable[[str], str]
) -> None:
    headers = _auth(login(seeded.manager_a))
    four = client.get("/dashboard/analytics?range=4w", headers=headers).json()
    twelve = client.get("/dashboard/analytics?range=12w", headers=headers).json()
    everything = client.get("/dashboard/analytics?range=all", headers=headers).json()

    assert len(four["weekly"]) == 4
    assert len(twelve["weekly"]) == 12
    assert len(everything["weekly"]) >= 6  # oldest opportunity is ~40 days old
    assert sum(w["opportunities_created"] for w in twelve["weekly"]) == 4
    # The 40-day-old opportunity falls outside the 4-week window.
    assert sum(w["opportunities_created"] for w in four["weekly"]) == 3
    assert [w["week_start"] for w in twelve["weekly"]] == sorted(
        w["week_start"] for w in twelve["weekly"]
    )


def test_package_mix_and_ai_breakdown(
    client: TestClient, seeded: TwoOrgs, login: Callable[[str], str]
) -> None:
    body = client.get(
        "/dashboard/analytics?range=12w", headers=_auth(login(seeded.manager_a))
    ).json()

    packages = {p["name"]: p for p in body["packages"]}
    assert packages["Electric City"]["quantity"] == 3  # 1 + 2 across versions
    assert Decimal(packages["Electric City"]["value"]) == Decimal("2298.00")
    assert body["packages"][0]["name"] == "Electric City"  # sorted by value, high to low
    assert "Other tenant" not in str(body)

    assert [a["provider"] for a in body["ai"]] == ["ollama"]
    ollama = body["ai"][0]
    assert (ollama["total"], ollama["succeeded"], ollama["failed"], ollama["fallbacks"]) == (
        3,
        2,
        1,
        1,
    )
    assert ollama["median_latency_ms"] == 2000


def test_all_range_includes_older_ai_generations(
    client: TestClient, seeded: TwoOrgs, login: Callable[[str], str]
) -> None:
    body = client.get(
        "/dashboard/analytics?range=all", headers=_auth(login(seeded.manager_a))
    ).json()
    assert {a["provider"] for a in body["ai"]} == {"ollama", "openrouter"}


def test_empty_tenant_returns_zeroes_not_errors(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    body = client.get(
        "/dashboard/analytics?range=all", headers=_auth(login(two_orgs.admin_b))
    ).json()
    kpis = body["kpis"]
    assert Decimal(kpis["open_pipeline_value"]) == 0
    assert kpis["win_rate"] is None
    assert kpis["median_approval_hours"] is None
    assert kpis["ai_success_rate"] is None
    assert body["packages"] == [] and body["ai"] == []
    assert len(body["weekly"]) == 1
