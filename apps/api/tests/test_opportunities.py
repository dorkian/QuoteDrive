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

    response = client.post(
        "/opportunities",
        json={"title": "Fleet deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(token),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Fleet deal"
    assert body["status"] == "open"
    assert body["customer_id"] == two_orgs.customer_a_id
    assert body["organization_id"] == two_orgs.org_a_id


def test_create_opportunity_with_foreign_customer_returns_404(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.manager_a)

    response = client.post(
        "/opportunities",
        json={"title": "Cross-tenant customer deal", "customer_id": two_orgs.customer_b_id},
        headers=_auth(token),
    )

    assert response.status_code == 404


def test_create_opportunity_with_nonexistent_customer_returns_404(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.manager_a)

    response = client.post(
        "/opportunities",
        json={"title": "Ghost customer deal", "customer_id": 999999},
        headers=_auth(token),
    )

    assert response.status_code == 404


def test_patch_updates_title_status_and_brief_json(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.admin_a)
    created = client.post(
        "/opportunities",
        json={"title": "Fleet deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(token),
    ).json()

    brief = {"target_vehicles": 12, "use_case": "mobility services"}
    response = client.patch(
        f"/opportunities/{created['id']}",
        json={"title": "Renamed", "status": "configured", "brief_json": brief},
        headers=_auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Renamed"
    assert body["status"] == "configured"
    assert body["brief_json"] == brief


def test_list_opportunities_with_filters(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin_token = login(two_orgs.admin_a)
    manager_token = login(two_orgs.manager_a)

    # Create a second customer in Org A
    new_customer = client.post(
        "/customers",
        json={"name": "Second Customer Org A"},
        headers=_auth(admin_token),
    ).json()

    # Opp 1: Customer A, manager_a, open
    opp1 = client.post(
        "/opportunities",
        json={"title": "Opp 1", "customer_id": two_orgs.customer_a_id},
        headers=_auth(manager_token),
    ).json()

    # Opp 2: New customer, admin_a, configured
    opp2 = client.post(
        "/opportunities",
        json={"title": "Opp 2", "customer_id": new_customer["id"]},
        headers=_auth(admin_token),
    ).json()
    client.patch(
        f"/opportunities/{opp2['id']}",
        json={"status": "configured"},
        headers=_auth(admin_token),
    )

    # Filter by customer_id
    by_cust = client.get(
        f"/opportunities?customer_id={two_orgs.customer_a_id}", headers=_auth(admin_token)
    ).json()
    assert [o["id"] for o in by_cust] == [opp1["id"]]

    # Filter by status
    by_status = client.get("/opportunities?status=configured", headers=_auth(admin_token)).json()
    assert [o["id"] for o in by_status] == [opp2["id"]]

    # Filter by owner_id
    by_owner = client.get(
        f"/opportunities?owner_id={opp1['owner_id']}", headers=_auth(admin_token)
    ).json()
    assert opp1["id"] in [o["id"] for o in by_owner]


def test_delete_opportunity_happy_path(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.admin_a)
    created = client.post(
        "/opportunities",
        json={"title": "To Delete", "customer_id": two_orgs.customer_a_id},
        headers=_auth(token),
    ).json()

    del_response = client.delete(f"/opportunities/{created['id']}", headers=_auth(token))
    assert del_response.status_code == 204

    get_response = client.get(f"/opportunities/{created['id']}", headers=_auth(token))
    assert get_response.status_code == 404


def test_get_nonexistent_opportunity_in_own_org_returns_404(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.admin_a)

    response = client.get("/opportunities/999999", headers=_auth(token))

    assert response.status_code == 404


def test_delete_opportunity_emits_audit_event(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.admin_a)
    created = client.post(
        "/opportunities",
        json={"title": "To Delete With Audit", "customer_id": two_orgs.customer_a_id},
        headers=_auth(token),
    ).json()

    del_response = client.delete(f"/opportunities/{created['id']}", headers=_auth(token))
    assert del_response.status_code == 204

    audit_res = client.get(
        f"/audit-events?entity_type=opportunity&entity_id={created['id']}",
        headers=_auth(token),
    )
    assert audit_res.status_code == 200
    events = audit_res.json()
    assert len(events) == 2
    # Ordered most recent first: delete, create
    assert events[0]["action"] == "delete"
    assert events[0]["entity_type"] == "opportunity"
    assert events[0]["entity_id"] == created["id"]
    assert events[0]["before_json"] == {
        "title": "To Delete With Audit",
        "status": "open",
        "customer_id": two_orgs.customer_a_id,
    }
    assert events[0]["after_json"] is None
