"""Role-based access control: for each of the four roles, assert what create/
list/get/patch/delete on tenant-owned resources (Opportunity and Customer) should do,
per security-and-tenancy.md's roles matrix (Create/edit/delete: Admin + Proposal Manager
only; view: all four roles).

Three AC items from the QD-105 card can't be tested yet — they describe
Proposal/ApprovalRequest behavior (submit, approve, self-approval, state
transitions) and no such domain exists in the codebase. Marked skip rather
than silently dropped; see the QD-105 Trello card for the scope decision.
"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_unauthenticated_request_returns_401(client: TestClient) -> None:
    assert client.get("/opportunities").status_code == 401
    assert client.get("/customers").status_code == 401


# --- Opportunities RBAC ---


@pytest.mark.parametrize("role_attr", ["admin_a", "manager_a"])
def test_admin_and_manager_can_manage_opportunities(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], role_attr: str
) -> None:
    token = login(getattr(two_orgs, role_attr))

    created = client.post(
        "/opportunities",
        json={"title": "Fleet deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(token),
    )
    assert created.status_code == 201

    patched = client.patch(
        f"/opportunities/{created.json()['id']}",
        json={"title": "Renamed"},
        headers=_auth(token),
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "Renamed"

    deleted = client.delete(f"/opportunities/{created.json()['id']}", headers=_auth(token))
    assert deleted.status_code == 204


@pytest.mark.parametrize("role_attr", ["approver_a", "viewer_a"])
def test_approver_and_viewer_cannot_manage_opportunities(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], role_attr: str
) -> None:
    admin_token = login(two_orgs.admin_a)
    existing = client.post(
        "/opportunities",
        json={"title": "Fleet deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(admin_token),
    ).json()

    token = login(getattr(two_orgs, role_attr))

    create_response = client.post(
        "/opportunities",
        json={"title": "Another deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(token),
    )
    assert create_response.status_code == 403

    patch_response = client.patch(
        f"/opportunities/{existing['id']}", json={"title": "Renamed"}, headers=_auth(token)
    )
    assert patch_response.status_code == 403

    delete_response = client.delete(f"/opportunities/{existing['id']}", headers=_auth(token))
    assert delete_response.status_code == 403


@pytest.mark.parametrize("role_attr", ["admin_a", "manager_a", "approver_a", "viewer_a"])
def test_every_role_can_view_opportunities(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], role_attr: str
) -> None:
    admin_token = login(two_orgs.admin_a)
    existing = client.post(
        "/opportunities",
        json={"title": "Fleet deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(admin_token),
    ).json()

    token = login(getattr(two_orgs, role_attr))

    list_response = client.get("/opportunities", headers=_auth(token))
    assert list_response.status_code == 200

    get_response = client.get(f"/opportunities/{existing['id']}", headers=_auth(token))
    assert get_response.status_code == 200


# --- Customers RBAC ---


@pytest.mark.parametrize("role_attr", ["admin_a", "manager_a"])
def test_admin_and_manager_can_manage_customers(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], role_attr: str
) -> None:
    token = login(getattr(two_orgs, role_attr))

    created = client.post(
        "/customers",
        json={"name": "New Corp"},
        headers=_auth(token),
    )
    assert created.status_code == 201

    patched = client.patch(
        f"/customers/{created.json()['id']}",
        json={"name": "New Corp Updated"},
        headers=_auth(token),
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "New Corp Updated"

    deleted = client.delete(f"/customers/{created.json()['id']}", headers=_auth(token))
    assert deleted.status_code == 204


@pytest.mark.parametrize("role_attr", ["approver_a", "viewer_a"])
def test_approver_and_viewer_cannot_manage_customers(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], role_attr: str
) -> None:
    admin_token = login(two_orgs.admin_a)
    existing = client.post(
        "/customers",
        json={"name": "Protected Corp"},
        headers=_auth(admin_token),
    ).json()

    token = login(getattr(two_orgs, role_attr))

    create_res = client.post("/customers", json={"name": "Forbidden"}, headers=_auth(token))
    assert create_res.status_code == 403

    patch_res = client.patch(
        f"/customers/{existing['id']}", json={"name": "Renamed"}, headers=_auth(token)
    )
    assert patch_res.status_code == 403

    del_res = client.delete(f"/customers/{existing['id']}", headers=_auth(token))
    assert del_res.status_code == 403


@pytest.mark.parametrize("role_attr", ["admin_a", "manager_a", "approver_a", "viewer_a"])
def test_every_role_can_view_customers(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], role_attr: str
) -> None:
    token = login(getattr(two_orgs, role_attr))

    list_res = client.get("/customers", headers=_auth(token))
    assert list_res.status_code == 200

    get_res = client.get(f"/customers/{two_orgs.customer_a_id}", headers=_auth(token))
    assert get_res.status_code == 200


# --- Deferred: no Proposal/ApprovalRequest domain exists yet (see QD-105 card) ---


@pytest.mark.skip(reason="Proposal domain doesn't exist yet — deferred, see QD-105 Trello card")
def test_viewer_cannot_submit_or_approve_proposal() -> None:
    raise NotImplementedError


@pytest.mark.skip(reason="Proposal domain doesn't exist yet — deferred, see QD-105 Trello card")
def test_proposal_manager_cannot_approve_own_version() -> None:
    raise NotImplementedError


@pytest.mark.skip(reason="Proposal domain doesn't exist yet — deferred, see QD-105 Trello card")
def test_illegal_state_transition_returns_400() -> None:
    raise NotImplementedError
