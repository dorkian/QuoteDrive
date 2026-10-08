"""Integration tests for proposal submission, approval requests, and the decision workflow."""

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
def seeded_env(db_session: Session, two_orgs: TwoOrgs) -> dict[str, int]:
    opp_a = Opportunity(
        organization_id=two_orgs.org_a_id,
        customer_id=two_orgs.customer_a_id,
        owner_id=1,
        title="Org A Opportunity",
        status="open",
    )
    opp_b = Opportunity(
        organization_id=two_orgs.org_b_id,
        customer_id=two_orgs.customer_b_id,
        owner_id=5,
        title="Org B Opportunity",
        status="open",
    )
    db_session.add_all([opp_a, opp_b])
    db_session.commit()
    db_session.refresh(opp_a)
    db_session.refresh(opp_b)

    return {"opp_a_id": opp_a.id, "opp_b_id": opp_b.id}


def _make_awaiting_approval_version(
    client: TestClient, token: str, opportunity_id: int
) -> dict[str, Any]:
    version = client.post(
        f"/opportunities/{opportunity_id}/versions", json={}, headers=_auth(token)
    ).json()
    client.post(f"/proposal-versions/{version['id']}/finalize", headers=_auth(token))
    submitted = client.post(f"/proposal-versions/{version['id']}/submit", headers=_auth(token))
    assert submitted.status_code == 200
    result: dict[str, Any] = submitted.json()
    return result


def test_unauthenticated_request_returns_401(client: TestClient) -> None:
    assert client.get("/approval-requests").status_code == 401
    assert client.get("/approval-requests/1").status_code == 401
    assert client.post("/proposal-versions/1/submit").status_code == 401
    assert client.post("/proposal-versions/1/approval-request", json={}).status_code == 401
    assert client.post("/approval-requests/1/approve", json={}).status_code == 401
    assert client.post("/approval-requests/1/request-changes", json={}).status_code == 401


def test_submit_requires_proposal_drafted_status(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    token = login(two_orgs.manager_a)
    version = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions", json={}, headers=_auth(token)
    ).json()

    response = client.post(f"/proposal-versions/{version['id']}/submit", headers=_auth(token))
    assert response.status_code == 400


def test_full_happy_path_submit_request_approve(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    assert version["status"] == "awaiting_approval"

    request = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    )
    assert request.status_code == 201
    request_data = request.json()
    assert request_data["status"] == "pending"

    approved = client.post(
        f"/approval-requests/{request_data['id']}/approve",
        json={"comment": "Looks good"},
        headers=_auth(approver_token),
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    version_after = client.get(
        f"/proposal-versions/{version['id']}", headers=_auth(approver_token)
    ).json()
    assert version_after["status"] == "approved"

    request_events = client.get(
        f"/audit-events?entity_type=approval_request&entity_id={request_data['id']}",
        headers=_auth(manager_token),
    ).json()
    assert any(e["action"] == "approve" for e in request_events)

    version_events = client.get(
        f"/audit-events?entity_type=proposal_version&entity_id={version['id']}",
        headers=_auth(manager_token),
    ).json()
    assert any(e["action"] == "approve" for e in version_events)


def test_request_changes_forks_new_draft_version(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    request_data = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()

    decided = client.post(
        f"/approval-requests/{request_data['id']}/request-changes",
        json={"comment": "Please add the roadside add-on"},
        headers=_auth(approver_token),
    )
    assert decided.status_code == 200
    assert decided.json()["status"] == "changes_requested"

    old_version = client.get(
        f"/proposal-versions/{version['id']}", headers=_auth(manager_token)
    ).json()
    assert old_version["status"] == "changes_requested"

    versions = client.get(
        f"/opportunities/{seeded_env['opp_a_id']}/versions", headers=_auth(manager_token)
    ).json()
    assert len(versions) == 2
    new_version = next(v for v in versions if v["id"] != version["id"])
    assert new_version["status"] == "draft"
    assert new_version["version_number"] == version["version_number"] + 1
    assert new_version["content_json"] == version["content_json"]

    request_events = client.get(
        f"/audit-events?entity_type=approval_request&entity_id={request_data['id']}",
        headers=_auth(manager_token),
    ).json()
    assert any(e["action"] == "request_changes" for e in request_events)

    old_version_events = client.get(
        f"/audit-events?entity_type=proposal_version&entity_id={version['id']}",
        headers=_auth(manager_token),
    ).json()
    assert any(e["action"] == "changes_requested" for e in old_version_events)

    new_version_events = client.get(
        f"/audit-events?entity_type=proposal_version&entity_id={new_version['id']}",
        headers=_auth(manager_token),
    ).json()
    assert any(e["action"] == "create" for e in new_version_events)


def test_request_changes_requires_comment(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    request_data = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()

    response = client.post(
        f"/approval-requests/{request_data['id']}/request-changes",
        json={"comment": ""},
        headers=_auth(approver_token),
    )
    assert response.status_code == 422


def test_request_changes_rejects_whitespace_only_comment(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    request_data = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()

    response = client.post(
        f"/approval-requests/{request_data['id']}/request-changes",
        json={"comment": "   "},
        headers=_auth(approver_token),
    )
    assert response.status_code == 422


def test_request_changes_rejects_comment_over_max_length(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    request_data = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()

    response = client.post(
        f"/approval-requests/{request_data['id']}/request-changes",
        json={"comment": "a" * 4097},
        headers=_auth(approver_token),
    )
    assert response.status_code == 422


def test_approve_requires_version_still_awaiting_approval(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
    db_session: Session,
) -> None:
    """The approval_request's own pending/decided status can't diverge from the
    version's status through any normal API flow today, but security-and-tenancy.md's
    lifecycle table names the *version's* status as the actual precondition — guard
    that directly rather than only its usual proxy. Constructed by mutating the version
    out from under a still-pending request, since the API itself can't produce this."""
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    request_data = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()

    db_version = db_session.get(ProposalVersion, version["id"])
    assert db_version is not None
    db_version.status = ProposalVersionStatus.DRAFT
    db_session.commit()

    response = client.post(
        f"/approval-requests/{request_data['id']}/approve",
        json={},
        headers=_auth(approver_token),
    )
    assert response.status_code == 400


def test_owner_cannot_approve_own_version(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    admin_token = login(two_orgs.admin_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, admin_token, seeded_env["opp_a_id"])
    request_data = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(admin_token),
    ).json()

    response = client.post(
        f"/approval-requests/{request_data['id']}/approve",
        json={},
        headers=_auth(admin_token),
    )
    assert response.status_code == 403


def test_owner_cannot_request_changes_on_own_version(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    admin_token = login(two_orgs.admin_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, admin_token, seeded_env["opp_a_id"])
    request_data = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(admin_token),
    ).json()

    response = client.post(
        f"/approval-requests/{request_data['id']}/request-changes",
        json={"comment": "hmm"},
        headers=_auth(admin_token),
    )
    assert response.status_code == 403


def test_assigned_to_must_not_equal_owner(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    manager_id = client.get("/me", headers=_auth(manager_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    response = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": manager_id},
        headers=_auth(manager_token),
    )
    assert response.status_code == 400


def test_assigned_to_must_be_admin_or_approver(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    viewer_token = login(two_orgs.viewer_a)
    viewer_id = client.get("/me", headers=_auth(viewer_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    response = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": viewer_id},
        headers=_auth(manager_token),
    )
    assert response.status_code == 404


def test_duplicate_pending_request_returns_400(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    first = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    )
    assert first.status_code == 201

    second = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    )
    assert second.status_code == 400


def test_approving_an_already_decided_request_returns_400(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    request_data = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()
    client.post(
        f"/approval-requests/{request_data['id']}/approve",
        json={},
        headers=_auth(approver_token),
    )

    response = client.post(
        f"/approval-requests/{request_data['id']}/approve",
        json={},
        headers=_auth(approver_token),
    )
    assert response.status_code == 400


@pytest.mark.parametrize("role_attr", ["approver_a", "viewer_a"])
def test_only_admin_or_manager_can_submit(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
    role_attr: str,
) -> None:
    admin_token = login(two_orgs.admin_a)
    version = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions", json={}, headers=_auth(admin_token)
    ).json()
    client.post(f"/proposal-versions/{version['id']}/finalize", headers=_auth(admin_token))

    token = login(getattr(two_orgs, role_attr))
    response = client.post(f"/proposal-versions/{version['id']}/submit", headers=_auth(token))
    assert response.status_code == 403


@pytest.mark.parametrize("role_attr", ["manager_a", "viewer_a"])
def test_only_admin_or_approver_can_decide(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
    role_attr: str,
) -> None:
    admin_token = login(two_orgs.admin_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, admin_token, seeded_env["opp_a_id"])
    request_data = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(admin_token),
    ).json()

    token = login(getattr(two_orgs, role_attr))
    response = client.post(
        f"/approval-requests/{request_data['id']}/approve",
        json={},
        headers=_auth(token),
    )
    assert response.status_code == 403


def test_cross_tenant_submit_and_approval_request_return_404(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    token_a = login(two_orgs.manager_a)
    version = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions", json={}, headers=_auth(token_a)
    ).json()

    token_b = login(two_orgs.admin_b)
    assert (
        client.post(
            f"/proposal-versions/{version['id']}/submit", headers=_auth(token_b)
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/proposal-versions/{version['id']}/approval-request",
            json={"assigned_to": 1},
            headers=_auth(token_b),
        ).status_code
        == 404
    )


def test_cross_tenant_approve_and_request_changes_return_404(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    version = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    request_data = client.post(
        f"/proposal-versions/{version['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()

    token_b = login(two_orgs.admin_b)
    assert (
        client.post(
            f"/approval-requests/{request_data['id']}/approve",
            json={},
            headers=_auth(token_b),
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/approval-requests/{request_data['id']}/request-changes",
            json={"comment": "x"},
            headers=_auth(token_b),
        ).status_code
        == 404
    )


def test_list_approval_requests_filters_by_status(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    v1 = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    req1 = client.post(
        f"/proposal-versions/{v1['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()

    opp2 = client.post(
        "/opportunities",
        json={"title": "Second Deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(manager_token),
    ).json()
    v2 = _make_awaiting_approval_version(client, manager_token, opp2["id"])
    req2 = client.post(
        f"/proposal-versions/{v2['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()

    client.post(f"/approval-requests/{req1['id']}/approve", json={}, headers=_auth(approver_token))

    pending_res = client.get("/approval-requests?status=pending", headers=_auth(approver_token))
    assert pending_res.status_code == 200
    pending_list = pending_res.json()
    assert len(pending_list) == 1
    assert pending_list[0]["id"] == req2["id"]
    assert pending_list[0]["status"] == "pending"

    all_res = client.get("/approval-requests", headers=_auth(approver_token))
    assert all_res.status_code == 200
    all_list = all_res.json()
    assert len(all_list) == 2


def test_list_approval_requests_tenant_scoped(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_a_token = login(two_orgs.manager_a)
    approver_a_token = login(two_orgs.approver_a)
    approver_a_id = client.get("/me", headers=_auth(approver_a_token)).json()["user"]["id"]

    admin_b_token = login(two_orgs.admin_b)

    v_a = _make_awaiting_approval_version(client, manager_a_token, seeded_env["opp_a_id"])
    req_a = client.post(
        f"/proposal-versions/{v_a['id']}/approval-request",
        json={"assigned_to": approver_a_id},
        headers=_auth(manager_a_token),
    ).json()

    list_b = client.get("/approval-requests", headers=_auth(admin_b_token)).json()
    assert all(r["organization_id"] == two_orgs.org_b_id for r in list_b)
    assert not any(r["id"] == req_a["id"] for r in list_b)


@pytest.mark.parametrize("role_attr", ["manager_a", "viewer_a"])
def test_only_admin_or_approver_can_list_and_get_approval_requests(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
    role_attr: str,
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    v = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    req = client.post(
        f"/proposal-versions/{v['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()

    token = login(getattr(two_orgs, role_attr))
    assert client.get("/approval-requests", headers=_auth(token)).status_code == 403
    assert client.get(f"/approval-requests/{req['id']}", headers=_auth(token)).status_code == 403


def test_get_approval_request_detail_returns_enriched_item(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    v = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    req = client.post(
        f"/proposal-versions/{v['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()

    detail = client.get(f"/approval-requests/{req['id']}", headers=_auth(approver_token))
    assert detail.status_code == 200
    data = detail.json()
    assert data["id"] == req["id"]
    assert data["opportunity_id"] == seeded_env["opp_a_id"]
    assert data["opportunity_title"] == "Org A Opportunity"
    assert data["version_number"] == 1
    assert data["requested_by_name"] == "manager-a@example.com"
    assert data["assigned_to_name"] == "approver-a@example.com"
    assert data["status"] == "pending"


def test_get_approval_request_cross_tenant_returns_404(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    approver_token = login(two_orgs.approver_a)
    approver_id = client.get("/me", headers=_auth(approver_token)).json()["user"]["id"]

    v = _make_awaiting_approval_version(client, manager_token, seeded_env["opp_a_id"])
    req = client.post(
        f"/proposal-versions/{v['id']}/approval-request",
        json={"assigned_to": approver_id},
        headers=_auth(manager_token),
    ).json()

    token_b = login(two_orgs.admin_b)
    assert client.get(f"/approval-requests/{req['id']}", headers=_auth(token_b)).status_code == 404


def test_approvers_list_has_admins_and_approvers_but_not_the_creator(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    manager_token = login(two_orgs.manager_a)
    version = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions", json={}, headers=_auth(manager_token)
    ).json()

    response = client.get(
        f"/proposal-versions/{version['id']}/approvers", headers=_auth(manager_token)
    )

    assert response.status_code == 200
    assert {a["display_name"] for a in response.json()} == {two_orgs.admin_a, two_orgs.approver_a}
    assert {a["role"] for a in response.json()} == {"admin", "approver"}


def test_approvers_list_excludes_an_admin_who_created_the_version(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    admin_token = login(two_orgs.admin_a)
    version = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions", json={}, headers=_auth(admin_token)
    ).json()

    response = client.get(
        f"/proposal-versions/{version['id']}/approvers", headers=_auth(admin_token)
    )

    assert [a["display_name"] for a in response.json()] == [two_orgs.approver_a]


def test_approvers_list_forbidden_for_approver_and_viewer(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    version = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(login(two_orgs.manager_a)),
    ).json()

    for email in (two_orgs.approver_a, two_orgs.viewer_a):
        response = client.get(
            f"/proposal-versions/{version['id']}/approvers", headers=_auth(login(email))
        )
        assert response.status_code == 403


def test_approvers_list_is_tenant_scoped_and_needs_auth(
    client: TestClient, two_orgs: TwoOrgs, seeded_env: dict[str, int], login: Callable[[str], str]
) -> None:
    version = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(login(two_orgs.manager_a)),
    ).json()

    cross_tenant = client.get(
        f"/proposal-versions/{version['id']}/approvers",
        headers=_auth(login(two_orgs.admin_b)),
    )

    assert cross_tenant.status_code == 404
    assert client.get(f"/proposal-versions/{version['id']}/approvers").status_code == 401
