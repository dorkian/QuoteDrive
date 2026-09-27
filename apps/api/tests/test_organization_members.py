"""Workspace members: Admin-only listing and role changes (QD-416)."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _user_id(client: TestClient, token: str) -> int:
    user_id: int = client.get("/me", headers=_auth(token)).json()["user"]["id"]
    return user_id


def test_admin_lists_only_their_organizations_members(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    response = client.get("/organization/members", headers=_auth(login(two_orgs.admin_a)))

    assert response.status_code == 200
    members = response.json()
    assert [m["email"] for m in members] == [
        "admin-a@example.com",
        "approver-a@example.com",
        "manager-a@example.com",
        "viewer-a@example.com",
    ]
    assert members[0]["role"] == "admin"
    assert set(members[0]) == {"user_id", "email", "display_name", "role"}


@pytest.mark.parametrize("who", ["manager_a", "approver_a", "viewer_a"])
def test_non_admins_get_403(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], who: str
) -> None:
    token = login(getattr(two_orgs, who))
    target = _user_id(client, login(two_orgs.viewer_a))

    assert client.get("/organization/members", headers=_auth(token)).status_code == 403
    response = client.patch(
        f"/organization/members/{target}", json={"role": "admin"}, headers=_auth(token)
    )
    assert response.status_code == 403


def test_admin_changes_a_role_and_it_is_audited(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)
    viewer_id = _user_id(client, login(two_orgs.viewer_a))

    response = client.patch(
        f"/organization/members/{viewer_id}", json={"role": "approver"}, headers=_auth(admin)
    )

    assert response.status_code == 200
    assert response.json()["role"] == "approver"
    # The new role applies to the member's next request.
    me = client.get("/me", headers=_auth(login(two_orgs.viewer_a))).json()
    assert me["role"] == "approver"
    events = client.get(
        "/audit-events",
        params={"entity_type": "membership", "entity_id": viewer_id},
        headers=_auth(admin),
    ).json()
    assert len(events) == 1
    assert events[0]["action"] == "role_change"
    assert events[0]["before_json"]["role"] == "viewer"
    assert events[0]["after_json"]["role"] == "approver"


def test_unchanged_role_is_a_no_op_without_audit(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)
    viewer_id = _user_id(client, login(two_orgs.viewer_a))

    response = client.patch(
        f"/organization/members/{viewer_id}", json={"role": "viewer"}, headers=_auth(admin)
    )

    assert response.status_code == 200
    events = client.get(
        "/audit-events", params={"entity_type": "membership"}, headers=_auth(admin)
    ).json()
    assert events == []


def test_last_admin_cannot_be_demoted(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)
    admin_id = _user_id(client, admin)

    response = client.patch(
        f"/organization/members/{admin_id}", json={"role": "viewer"}, headers=_auth(admin)
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot remove the last Admin of the organization"


def test_an_admin_can_step_down_once_another_admin_exists(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)
    admin_id = _user_id(client, admin)
    manager_id = _user_id(client, login(two_orgs.manager_a))
    client.patch(
        f"/organization/members/{manager_id}", json={"role": "admin"}, headers=_auth(admin)
    )

    response = client.patch(
        f"/organization/members/{admin_id}",
        json={"role": "proposal_manager"},
        headers=_auth(admin),
    )

    assert response.status_code == 200
    assert response.json()["role"] == "proposal_manager"


def test_member_of_another_org_is_not_found(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    other_admin_id = _user_id(client, login(two_orgs.admin_b))

    response = client.patch(
        f"/organization/members/{other_admin_id}",
        json={"role": "viewer"},
        headers=_auth(login(two_orgs.admin_a)),
    )

    assert response.status_code == 404


def test_unknown_role_is_rejected(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)
    viewer_id = _user_id(client, login(two_orgs.viewer_a))

    response = client.patch(
        f"/organization/members/{viewer_id}", json={"role": "owner"}, headers=_auth(admin)
    )

    assert response.status_code == 422
