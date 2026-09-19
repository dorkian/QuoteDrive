"""General Opportunity CRUD correctness — tenant-isolation and RBAC concerns
live in test_tenant_isolation.py and test_rbac.py respectively."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_create_returns_the_created_opportunity(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.manager_a)

    response = client.post("/opportunities", json={"title": "Fleet deal"}, headers=_auth(token))

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Fleet deal"
    assert body["status"] == "open"
    assert body["organization_id"] == two_orgs.org_a_id


def test_patch_updates_title_and_status(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.admin_a)
    created = client.post(
        "/opportunities", json={"title": "Fleet deal"}, headers=_auth(token)
    ).json()

    response = client.patch(
        f"/opportunities/{created['id']}",
        json={"title": "Renamed", "status": "configured"},
        headers=_auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Renamed"
    assert body["status"] == "configured"


def test_get_nonexistent_opportunity_in_own_org_returns_404(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.admin_a)

    response = client.get("/opportunities/999999", headers=_auth(token))

    assert response.status_code == 404
