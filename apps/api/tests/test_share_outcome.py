"""Share an approved version and record its outcome (QD-414)."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.opportunity import Opportunity
from app.models.proposal_version import ProposalVersion, ProposalVersionStatus
from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def opportunity_id(db_session: Session, two_orgs: TwoOrgs) -> int:
    opportunity = Opportunity(
        organization_id=two_orgs.org_a_id,
        customer_id=two_orgs.customer_a_id,
        owner_id=1,
        title="Fleet Renewal",
        status="open",
    )
    db_session.add(opportunity)
    db_session.commit()
    return opportunity.id


def _version_in(
    client: TestClient,
    db_session: Session,
    token: str,
    opportunity_id: int,
    status: ProposalVersionStatus,
) -> dict[str, Any]:
    version: dict[str, Any] = client.post(
        f"/opportunities/{opportunity_id}/versions", json={}, headers=_auth(token)
    ).json()
    row = db_session.get(ProposalVersion, version["id"])
    assert row is not None
    row.status = status
    db_session.commit()
    return version


def _approved_via_workflow(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], opportunity_id: int
) -> dict[str, Any]:
    manager = login(two_orgs.manager_a)
    approver = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver)).json()["user"]["id"]
    version: dict[str, Any] = client.post(
        f"/opportunities/{opportunity_id}/versions", json={}, headers=_auth(manager)
    ).json()
    client.post(f"/proposal-versions/{version['id']}/finalize", headers=_auth(manager))
    client.post(f"/proposal-versions/{version['id']}/submit", headers=_auth(manager))
    request = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager),
    ).json()
    approved = client.post(
        f"/approval-requests/{request['id']}/approve", json={}, headers=_auth(approver)
    )
    assert approved.status_code == 200, approved.text
    return version


def test_share_then_win_updates_version_opportunity_and_audit(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], opportunity_id: int
) -> None:
    manager = login(two_orgs.manager_a)
    version = _approved_via_workflow(client, two_orgs, login, opportunity_id)

    shared = client.post(f"/proposal-versions/{version['id']}/share", headers=_auth(manager))
    won = client.post(
        f"/proposal-versions/{version['id']}/outcome",
        json={"outcome": "won"},
        headers=_auth(manager),
    )

    assert shared.status_code == 200
    assert shared.json()["status"] == "shared"
    assert won.status_code == 200
    assert won.json()["status"] == "won"
    opportunity = client.get(f"/opportunities/{opportunity_id}", headers=_auth(manager)).json()
    assert opportunity["status"] == "won"
    version_actions = [
        e["action"]
        for e in client.get(
            "/audit-events",
            params={"entity_type": "proposal_version", "entity_id": version["id"]},
            headers=_auth(manager),
        ).json()
    ]
    assert version_actions[:2] == ["outcome", "share"]
    opportunity_events = client.get(
        "/audit-events",
        params={"entity_type": "opportunity", "entity_id": opportunity_id},
        headers=_auth(manager),
    ).json()
    assert opportunity_events[0]["after_json"]["status"] == "won"


def test_lost_closes_the_opportunity_and_expired_leaves_it_open(
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    opportunity_id: int,
) -> None:
    manager = login(two_orgs.manager_a)
    expired = _version_in(client, db_session, manager, opportunity_id, ProposalVersionStatus.SHARED)

    response = client.post(
        f"/proposal-versions/{expired['id']}/outcome",
        json={"outcome": "expired"},
        headers=_auth(manager),
    )

    assert response.json()["status"] == "expired"
    opportunity = client.get(f"/opportunities/{opportunity_id}", headers=_auth(manager)).json()
    assert opportunity["status"] == "open"

    lost = _version_in(client, db_session, manager, opportunity_id, ProposalVersionStatus.SHARED)
    client.post(
        f"/proposal-versions/{lost['id']}/outcome",
        json={"outcome": "lost"},
        headers=_auth(manager),
    )
    opportunity = client.get(f"/opportunities/{opportunity_id}", headers=_auth(manager)).json()
    assert opportunity["status"] == "lost"


@pytest.mark.parametrize(
    "status",
    [
        ProposalVersionStatus.DRAFT,
        ProposalVersionStatus.PROPOSAL_DRAFTED,
        ProposalVersionStatus.AWAITING_APPROVAL,
        ProposalVersionStatus.SHARED,
        ProposalVersionStatus.WON,
        ProposalVersionStatus.CHANGES_REQUESTED,
    ],
)
def test_only_approved_versions_can_be_shared(
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    opportunity_id: int,
    status: ProposalVersionStatus,
) -> None:
    manager = login(two_orgs.manager_a)
    version = _version_in(client, db_session, manager, opportunity_id, status)

    response = client.post(f"/proposal-versions/{version['id']}/share", headers=_auth(manager))

    assert response.status_code == 400
    assert response.json()["detail"] == "Only an approved version can be shared"


@pytest.mark.parametrize(
    "status",
    [
        ProposalVersionStatus.DRAFT,
        ProposalVersionStatus.APPROVED,
        ProposalVersionStatus.WON,
        ProposalVersionStatus.LOST,
        ProposalVersionStatus.EXPIRED,
    ],
)
def test_outcome_requires_a_shared_version(
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    opportunity_id: int,
    status: ProposalVersionStatus,
) -> None:
    manager = login(two_orgs.manager_a)
    version = _version_in(client, db_session, manager, opportunity_id, status)

    response = client.post(
        f"/proposal-versions/{version['id']}/outcome",
        json={"outcome": "lost"},
        headers=_auth(manager),
    )

    assert response.status_code == 400


def test_unknown_outcome_is_rejected(
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    opportunity_id: int,
) -> None:
    manager = login(two_orgs.manager_a)
    version = _version_in(client, db_session, manager, opportunity_id, ProposalVersionStatus.SHARED)

    response = client.post(
        f"/proposal-versions/{version['id']}/outcome",
        json={"outcome": "cancelled"},
        headers=_auth(manager),
    )

    assert response.status_code == 422


@pytest.mark.parametrize("who", ["approver_a", "viewer_a"])
def test_approvers_and_viewers_cannot_share_or_record_outcomes(
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    opportunity_id: int,
    who: str,
) -> None:
    manager = login(two_orgs.manager_a)
    approved = _version_in(
        client, db_session, manager, opportunity_id, ProposalVersionStatus.APPROVED
    )
    token = login(getattr(two_orgs, who))

    share = client.post(f"/proposal-versions/{approved['id']}/share", headers=_auth(token))
    outcome = client.post(
        f"/proposal-versions/{approved['id']}/outcome",
        json={"outcome": "won"},
        headers=_auth(token),
    )

    assert share.status_code == 403
    assert outcome.status_code == 403


def test_other_tenants_version_is_not_found(
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    opportunity_id: int,
) -> None:
    approved = _version_in(
        client,
        db_session,
        login(two_orgs.manager_a),
        opportunity_id,
        ProposalVersionStatus.APPROVED,
    )
    other_admin = login(two_orgs.admin_b)

    share = client.post(f"/proposal-versions/{approved['id']}/share", headers=_auth(other_admin))
    outcome = client.post(
        f"/proposal-versions/{approved['id']}/outcome",
        json={"outcome": "won"},
        headers=_auth(other_admin),
    )

    assert share.status_code == 404
    assert outcome.status_code == 404


def test_viewer_can_read_a_shared_version(
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    opportunity_id: int,
) -> None:
    shared = _version_in(
        client,
        db_session,
        login(two_orgs.manager_a),
        opportunity_id,
        ProposalVersionStatus.SHARED,
    )

    response = client.get(
        f"/proposal-versions/{shared['id']}", headers=_auth(login(two_orgs.viewer_a))
    )

    assert response.status_code == 200
    assert response.json()["status"] == "shared"


def test_dashboard_counts_versions_by_status(
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    opportunity_id: int,
) -> None:
    manager = login(two_orgs.manager_a)
    for status in (
        ProposalVersionStatus.SHARED,
        ProposalVersionStatus.WON,
        ProposalVersionStatus.WON,
    ):
        _version_in(client, db_session, manager, opportunity_id, status)

    summary = client.get("/dashboard/summary", headers=_auth(manager)).json()

    assert summary["proposal_versions_by_status"] == {"shared": 1, "won": 2}
    other = client.get("/dashboard/summary", headers=_auth(login(two_orgs.admin_b))).json()
    assert other["proposal_versions_by_status"] == {}
