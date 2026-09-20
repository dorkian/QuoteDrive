"""Cross-tenant isolation: a wrong-org request must never succeed or leak that
the target row exists (security-and-tenancy.md Control #4 — 404, not 403,
for cross-tenant access, so an actor with the right role learns nothing about
another org's data)."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# --- Opportunities ---


def test_list_opportunities_is_scoped_to_own_org(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_a_token = login(two_orgs.admin_a)
    admin_b_token = login(two_orgs.admin_b)
    client.post(
        "/opportunities",
        json={"title": "Org A deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(admin_a_token),
    )
    client.post(
        "/opportunities",
        json={"title": "Org B deal", "customer_id": two_orgs.customer_b_id},
        headers=_auth(admin_b_token),
    )

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
        "/opportunities",
        json={"title": "Org A deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(admin_a_token),
    ).json()

    response = client.get(f"/opportunities/{created['id']}", headers=_auth(admin_b_token))

    assert response.status_code == 404


def test_write_cross_tenant_opportunity_returns_404_not_403(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_a_token = login(two_orgs.admin_a)
    admin_b_token = login(two_orgs.admin_b)
    created = client.post(
        "/opportunities",
        json={"title": "Org A deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(admin_a_token),
    ).json()

    response = client.patch(
        f"/opportunities/{created['id']}",
        json={"title": "Hijacked"},
        headers=_auth(admin_b_token),
    )

    assert response.status_code == 404


def test_delete_cross_tenant_opportunity_returns_404(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_a_token = login(two_orgs.admin_a)
    admin_b_token = login(two_orgs.admin_b)
    created = client.post(
        "/opportunities",
        json={"title": "Org A deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(admin_a_token),
    ).json()

    response = client.delete(
        f"/opportunities/{created['id']}",
        headers=_auth(admin_b_token),
    )

    assert response.status_code == 404


def test_create_opportunity_always_uses_the_actors_own_org(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_a_token = login(two_orgs.admin_a)

    response = client.post(
        "/opportunities",
        json={
            "title": "Spoof attempt",
            "customer_id": two_orgs.customer_a_id,
            "organization_id": two_orgs.org_b_id,
        },
        headers=_auth(admin_a_token),
    )

    assert response.status_code == 201
    assert response.json()["organization_id"] == two_orgs.org_a_id


# --- Customers ---


def test_list_customers_is_scoped_to_own_org(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_a_token = login(two_orgs.admin_a)
    admin_b_token = login(two_orgs.admin_b)

    res_a = client.get("/customers", headers=_auth(admin_a_token))
    assert res_a.status_code == 200
    names_a = [c["name"] for c in res_a.json()]
    assert names_a == ["Customer A"]

    res_b = client.get("/customers", headers=_auth(admin_b_token))
    assert res_b.status_code == 200
    names_b = [c["name"] for c in res_b.json()]
    assert names_b == ["Customer B"]


def test_get_cross_tenant_customer_returns_404(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_b_token = login(two_orgs.admin_b)
    response = client.get(f"/customers/{two_orgs.customer_a_id}", headers=_auth(admin_b_token))

    assert response.status_code == 404


def test_write_cross_tenant_customer_returns_404_not_403(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_b_token = login(two_orgs.admin_b)
    response = client.patch(
        f"/customers/{two_orgs.customer_a_id}",
        json={"name": "Hijacked"},
        headers=_auth(admin_b_token),
    )

    assert response.status_code == 404


def test_delete_cross_tenant_customer_returns_404(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_b_token = login(two_orgs.admin_b)
    response = client.delete(
        f"/customers/{two_orgs.customer_a_id}",
        headers=_auth(admin_b_token),
    )

    assert response.status_code == 404


def test_create_customer_always_uses_the_actors_own_org(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_a_token = login(two_orgs.admin_a)

    response = client.post(
        "/customers",
        json={"name": "Spoofed Customer", "organization_id": two_orgs.org_b_id},
        headers=_auth(admin_a_token),
    )

    assert response.status_code == 201
    assert response.json()["organization_id"] == two_orgs.org_a_id
