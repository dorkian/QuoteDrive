from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_summary_is_empty_for_an_org_with_no_opportunities(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.admin_a)

    response = client.get("/dashboard/summary", headers=_auth(token))

    assert response.status_code == 200
    assert response.json() == {"opportunities_by_status": {}, "proposal_versions_by_status": {}}


def test_summary_counts_are_scoped_to_the_caller_org(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    manager_a_token = login(two_orgs.manager_a)
    admin_b_token = login(two_orgs.admin_b)
    client.post(
        "/opportunities",
        json={"title": "Org A deal 1", "customer_id": two_orgs.customer_a_id},
        headers=_auth(manager_a_token),
    )
    client.post(
        "/opportunities",
        json={"title": "Org A deal 2", "customer_id": two_orgs.customer_a_id},
        headers=_auth(manager_a_token),
    )
    client.post(
        "/opportunities",
        json={"title": "Org B deal", "customer_id": two_orgs.customer_b_id},
        headers=_auth(admin_b_token),
    )

    response = client.get("/dashboard/summary", headers=_auth(manager_a_token))

    assert response.status_code == 200
    assert response.json() == {
        "opportunities_by_status": {"open": 2},
        "proposal_versions_by_status": {},
    }


def test_audit_events_appear_after_create_and_update_most_recent_first(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.manager_a)
    created = client.post(
        "/opportunities",
        json={"title": "Org A deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(token),
    ).json()
    client.patch(
        f"/opportunities/{created['id']}",
        json={"status": "configured"},
        headers=_auth(token),
    )

    response = client.get("/audit-events", headers=_auth(token))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["action"] == "update"
    assert body[0]["after_json"] == {"title": "Org A deal", "status": "configured"}
    assert body[0]["actor_name"] == two_orgs.manager_a
    assert body[1]["action"] == "create"
    assert body[1]["actor_name"] == two_orgs.manager_a


def test_audit_events_are_scoped_to_the_caller_org(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    manager_a_token = login(two_orgs.manager_a)
    admin_b_token = login(two_orgs.admin_b)
    client.post(
        "/opportunities",
        json={"title": "Org A deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(manager_a_token),
    )

    response = client.get("/audit-events", headers=_auth(admin_b_token))

    assert response.status_code == 200
    assert response.json() == []


def test_audit_events_filters_by_entity_type_and_entity_id(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.manager_a)
    first = client.post(
        "/opportunities",
        json={"title": "First deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(token),
    ).json()
    second = client.post(
        "/opportunities",
        json={"title": "Second deal", "customer_id": two_orgs.customer_a_id},
        headers=_auth(token),
    ).json()

    response = client.get(
        f"/audit-events?entity_type=opportunity&entity_id={second['id']}",
        headers=_auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["entity_id"] == second["id"]
    assert body[0]["after_json"] == {"title": "Second deal", "status": "open"}
    assert body[0]["actor_name"] == two_orgs.manager_a
    assert first["id"] != second["id"]


def test_audit_events_respects_limit(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.manager_a)
    for i in range(3):
        client.post(
            "/opportunities",
            json={"title": f"Deal {i}", "customer_id": two_orgs.customer_a_id},
            headers=_auth(token),
        )

    response = client.get("/audit-events?limit=2", headers=_auth(token))

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_audit_events_cursor_pagination_with_before_id(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.manager_a)
    created_ids = []
    for i in range(4):
        res = client.post(
            "/opportunities",
            json={"title": f"Deal {i}", "customer_id": two_orgs.customer_a_id},
            headers=_auth(token),
        ).json()
        created_ids.append(res["id"])

    # Page 1: 2 most recent events
    page1 = client.get("/audit-events?limit=2", headers=_auth(token)).json()
    assert len(page1) == 2
    assert page1[0]["entity_id"] == created_ids[3]
    assert page1[1]["entity_id"] == created_ids[2]

    # Page 2: events before the oldest event of page 1
    page2 = client.get(
        f"/audit-events?limit=2&before_id={page1[1]['id']}",
        headers=_auth(token),
    ).json()
    assert len(page2) == 2
    assert page2[0]["entity_id"] == created_ids[1]
    assert page2[1]["entity_id"] == created_ids[0]

    # Page 3: no more events
    page3 = client.get(
        f"/audit-events?limit=2&before_id={page2[1]['id']}",
        headers=_auth(token),
    ).json()
    assert len(page3) == 0


def test_audit_events_before_id_composes_with_entity_filters(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    token = login(two_orgs.manager_a)
    opp = client.post(
        "/opportunities",
        json={"title": "Target Opp", "customer_id": two_orgs.customer_a_id},
        headers=_auth(token),
    ).json()

    # Make 2 updates on this opportunity
    client.patch(
        f"/opportunities/{opp['id']}",
        json={"status": "configured"},
        headers=_auth(token),
    )
    client.patch(
        f"/opportunities/{opp['id']}",
        json={"title": "Target Opp Renamed"},
        headers=_auth(token),
    )

    # Fetch page 1 for this opportunity with limit=1
    page1 = client.get(
        f"/audit-events?entity_type=opportunity&entity_id={opp['id']}&limit=1",
        headers=_auth(token),
    ).json()
    assert len(page1) == 1
    assert page1[0]["after_json"]["title"] == "Target Opp Renamed"

    # Fetch next page using before_id
    page2 = client.get(
        f"/audit-events?entity_type=opportunity&entity_id={opp['id']}&limit=1&before_id={page1[0]['id']}",
        headers=_auth(token),
    ).json()
    assert len(page2) == 1
    assert page2[0]["after_json"]["status"] == "configured"
