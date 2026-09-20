"""Customer CRUD correctness and constraint protections."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_create_customer(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.manager_a)
    response = client.post(
        "/customers",
        json={"name": "Acme Corp", "industry": "Logistics"},
        headers=_auth(token),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Acme Corp"
    assert body["industry"] == "Logistics"
    assert body["status"] == "active"
    assert body["organization_id"] == two_orgs.org_a_id


def test_list_customers(client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]) -> None:
    token = login(two_orgs.admin_a)
    response = client.get("/customers", headers=_auth(token))

    assert response.status_code == 200
    names = [c["name"] for c in response.json()]
    assert "Customer A" in names


def test_get_customer(client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]) -> None:
    token = login(two_orgs.admin_a)
    response = client.get(f"/customers/{two_orgs.customer_a_id}", headers=_auth(token))

    assert response.status_code == 200
    assert response.json()["name"] == "Customer A"


def test_get_nonexistent_customer_returns_404(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.admin_a)
    response = client.get("/customers/999999", headers=_auth(token))

    assert response.status_code == 404


def test_patch_customer(client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]) -> None:
    token = login(two_orgs.admin_a)
    response = client.patch(
        f"/customers/{two_orgs.customer_a_id}",
        json={"name": "Customer A Updated", "industry": "Automotive", "status": "inactive"},
        headers=_auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Customer A Updated"
    assert body["industry"] == "Automotive"
    assert body["status"] == "inactive"


def test_delete_customer_happy_path(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.admin_a)
    created = client.post(
        "/customers",
        json={"name": "To Be Deleted"},
        headers=_auth(token),
    ).json()

    delete_res = client.delete(f"/customers/{created['id']}", headers=_auth(token))
    assert delete_res.status_code == 204

    get_res = client.get(f"/customers/{created['id']}", headers=_auth(token))
    assert get_res.status_code == 404


def test_delete_customer_with_existing_opportunities_returns_409(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.admin_a)
    # two_orgs.customer_a_id already has a customer; create an opportunity for it
    client.post(
        "/opportunities",
        json={"title": "Blocking deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(token),
    )

    response = client.delete(f"/customers/{two_orgs.customer_a_id}", headers=_auth(token))

    assert response.status_code == 409
    assert response.json()["detail"] == "Cannot delete customer with existing opportunities"
