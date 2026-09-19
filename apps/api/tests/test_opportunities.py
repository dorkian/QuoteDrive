from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_manager_can_create_opportunity_in_own_org(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.manager_a)

    response = client.post("/opportunities", json={"title": "Fleet deal"}, headers=_auth(token))

    assert response.status_code == 201
    assert response.json()["organization_id"] == two_orgs.org_a_id


def test_viewer_cannot_create_opportunity(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.viewer_a)

    response = client.post("/opportunities", json={"title": "Fleet deal"}, headers=_auth(token))

    assert response.status_code == 403


def test_approver_cannot_create_opportunity(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    # security-and-tenancy.md's roles matrix: only Admin/Proposal Manager create opportunities —
    # Approver is view-only here too, same as Viewer.
    token = login(two_orgs.approver_a)

    response = client.post("/opportunities", json={"title": "Fleet deal"}, headers=_auth(token))

    assert response.status_code == 403


def test_unauthenticated_request_returns_401(client: TestClient) -> None:
    response = client.get("/opportunities")

    assert response.status_code == 401


def test_list_opportunities_scoped_to_own_org(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_a_token = login(two_orgs.admin_a)
    admin_b_token = login(two_orgs.admin_b)
    client.post("/opportunities", json={"title": "Org A deal"}, headers=_auth(admin_a_token))
    client.post("/opportunities", json={"title": "Org B deal"}, headers=_auth(admin_b_token))

    response = client.get("/opportunities", headers=_auth(admin_a_token))

    assert response.status_code == 200
    titles = [o["title"] for o in response.json()]
    assert titles == ["Org A deal"]


def test_get_cross_tenant_opportunity_returns_404(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_a_token = login(two_orgs.admin_a)
    admin_b_token = login(two_orgs.admin_b)
    created = client.post(
        "/opportunities", json={"title": "Org A deal"}, headers=_auth(admin_a_token)
    ).json()

    response = client.get(f"/opportunities/{created['id']}", headers=_auth(admin_b_token))

    assert response.status_code == 404


def test_viewer_cannot_patch_opportunity(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_a_token = login(two_orgs.admin_a)
    viewer_a_token = login(two_orgs.viewer_a)
    created = client.post(
        "/opportunities", json={"title": "Org A deal"}, headers=_auth(admin_a_token)
    ).json()

    response = client.patch(
        f"/opportunities/{created['id']}",
        json={"title": "Renamed"},
        headers=_auth(viewer_a_token),
    )

    assert response.status_code == 403


def test_admin_can_patch_own_org_opportunity(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_a_token = login(two_orgs.admin_a)
    created = client.post(
        "/opportunities", json={"title": "Org A deal"}, headers=_auth(admin_a_token)
    ).json()

    response = client.patch(
        f"/opportunities/{created['id']}",
        json={"title": "Renamed"},
        headers=_auth(admin_a_token),
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"


def test_admin_patch_cross_tenant_opportunity_returns_404(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_a_token = login(two_orgs.admin_a)
    admin_b_token = login(two_orgs.admin_b)
    created = client.post(
        "/opportunities", json={"title": "Org A deal"}, headers=_auth(admin_a_token)
    ).json()

    response = client.patch(
        f"/opportunities/{created['id']}",
        json={"title": "Hijacked"},
        headers=_auth(admin_b_token),
    )

    assert response.status_code == 404
