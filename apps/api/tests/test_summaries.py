"""Summary fields on opportunity and customer lists (owner, value, activity)."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditEvent, Opportunity, ProposalVersion, ProposalVersionStatus, User
from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed(db: Session, orgs: TwoOrgs) -> dict[str, int]:
    manager = db.execute(select(User).where(User.email == orgs.manager_a)).scalar_one()
    admin_b = db.execute(select(User).where(User.email == orgs.admin_b)).scalar_one()
    now = datetime.now(UTC)

    busy = Opportunity(
        organization_id=orgs.org_a_id,
        customer_id=orgs.customer_a_id,
        owner_id=manager.id,
        title="Busy",
        status="open",
        created_at=now - timedelta(days=30),
    )
    quiet = Opportunity(
        organization_id=orgs.org_a_id,
        customer_id=orgs.customer_a_id,
        owner_id=manager.id,
        title="Quiet",
        status="open",
        created_at=now - timedelta(days=10),
    )
    closed = Opportunity(
        organization_id=orgs.org_a_id,
        customer_id=orgs.customer_a_id,
        owner_id=manager.id,
        title="Closed",
        status="won",
        created_at=now - timedelta(days=20),
    )
    foreign = Opportunity(
        organization_id=orgs.org_b_id,
        customer_id=orgs.customer_b_id,
        owner_id=admin_b.id,
        title="Foreign",
        status="open",
    )
    db.add_all([busy, quiet, closed, foreign])
    db.flush()

    def version(
        opp: Opportunity, number: int, status: ProposalVersionStatus, total: str
    ) -> ProposalVersion:
        row = ProposalVersion(
            organization_id=opp.organization_id,
            opportunity_id=opp.id,
            version_number=number,
            status=status,
            total_estimate=Decimal(total),
            content_json={"lines": []},
            created_by=manager.id,
        )
        db.add(row)
        db.flush()
        return row

    version(busy, 1, ProposalVersionStatus.CHANGES_REQUESTED, "1000.00")
    v2 = version(busy, 2, ProposalVersionStatus.AWAITING_APPROVAL, "2500.00")
    version(closed, 1, ProposalVersionStatus.WON, "9000.00")
    version(foreign, 1, ProposalVersionStatus.DRAFT, "77777.00")

    recent = now - timedelta(hours=2)
    db.add(
        AuditEvent(
            organization_id=orgs.org_a_id,
            actor_id=manager.id,
            actor_name="M",
            entity_type="proposal_version",
            entity_id=v2.id,
            action="submit",
            created_at=recent,
        )
    )
    db.commit()
    return {"busy": busy.id, "quiet": quiet.id, "closed": closed.id}


def test_opportunity_list_carries_owner_value_and_activity(
    client: TestClient, db_session: Session, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    ids = _seed(db_session, two_orgs)
    body = client.get("/opportunities", headers=_auth(login(two_orgs.viewer_a))).json()
    rows = {r["id"]: r for r in body}

    assert set(rows) == set(ids.values())  # nothing from the other tenant
    busy = rows[ids["busy"]]
    assert busy["owner_name"] == two_orgs.manager_a
    assert busy["version_count"] == 2
    assert busy["latest_version"]["version_number"] == 2
    assert busy["latest_version"]["status"] == "awaiting_approval"
    assert Decimal(busy["latest_version"]["total_estimate"]) == Decimal("2500.00")
    # The submit event two hours ago beats the creation date 30 days ago.
    activity = datetime.fromisoformat(busy["last_activity_at"])
    assert datetime.now(UTC) - activity.replace(tzinfo=activity.tzinfo or UTC) < timedelta(hours=3)

    quiet = rows[ids["quiet"]]
    assert quiet["version_count"] == 0 and quiet["latest_version"] is None
    assert quiet["last_activity_at"] is not None  # falls back to the creation date


def test_opportunity_get_and_patch_return_the_same_summary(
    client: TestClient, db_session: Session, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    ids = _seed(db_session, two_orgs)
    headers = _auth(login(two_orgs.manager_a))

    got = client.get(f"/opportunities/{ids['busy']}", headers=headers).json()
    patched = client.patch(
        f"/opportunities/{ids['busy']}", json={"title": "Busy renamed"}, headers=headers
    ).json()

    assert got["version_count"] == patched["version_count"] == 2
    assert patched["title"] == "Busy renamed"
    assert patched["owner_name"] == two_orgs.manager_a


def test_created_opportunity_has_an_empty_summary(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    created = client.post(
        "/opportunities",
        json={"customer_id": two_orgs.customer_a_id, "title": "Fresh"},
        headers=_auth(login(two_orgs.manager_a)),
    ).json()
    assert created["version_count"] == 0
    assert created["latest_version"] is None
    assert created["owner_name"] == two_orgs.manager_a


def test_customer_list_counts_opportunities_and_open_pipeline(
    client: TestClient, db_session: Session, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    _seed(db_session, two_orgs)
    headers = _auth(login(two_orgs.viewer_a))

    customers = client.get("/customers", headers=headers).json()
    assert len(customers) == 1
    summary = customers[0]
    assert summary["opportunity_count"] == 3
    assert summary["open_opportunities"] == 2
    # Latest live versions of the open opportunities only: 2500 (busy), nothing for quiet,
    # and the won deal is closed, so its 9000 is not pipeline.
    assert Decimal(summary["open_pipeline_value"]) == Decimal("2500.00")

    one = client.get(f"/customers/{summary['id']}", headers=headers).json()
    assert one["opportunity_count"] == 3
    assert "77777" not in str(customers)


def test_customer_create_and_update_return_a_summary(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    headers = _auth(login(two_orgs.manager_a))
    created = client.post("/customers", json={"name": "New Co"}, headers=headers).json()
    assert created["opportunity_count"] == 0
    updated = client.patch(
        f"/customers/{created['id']}", json={"industry": "Retail"}, headers=headers
    ).json()
    assert updated["industry"] == "Retail"
    assert Decimal(updated["open_pipeline_value"]) == 0
