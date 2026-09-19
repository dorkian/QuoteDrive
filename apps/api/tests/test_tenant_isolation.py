"""Cross-tenant isolation: a wrong-org request must never succeed or leak that
the target row exists (security-and-tenancy.md Control #4 — 404, not 403,
for cross-tenant access, so an actor with the right role learns nothing about
another org's data)."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_list_opportunities_is_scoped_to_own_org(
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


def test_write_cross_tenant_opportunity_returns_404_not_403(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    # Not 403: a role-valid actor (Admin) in the wrong org must not be able to tell
    # the row exists at all. QD-102's design, reviewed and approved — see the
    # QD-105 Trello card for why this deliberately differs from the card's own
    # AC wording ("cross-tenant write returns 403").
    #
    # "Write" here only covers PATCH — there's no DELETE endpoint on any
    # tenant-owned resource yet. Add a matching cross-tenant DELETE 404 test
    # (get_tenant_scoped_or_404 should already cover it) when one ships.
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


def test_create_always_uses_the_actors_own_org(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    # OpportunityCreate has no organization_id field at all, so a spoofed one in
    # the body is silently ignored (Pydantic drops unknown fields by default) —
    # the created row always lands in the actor's real org.
    admin_a_token = login(two_orgs.admin_a)

    response = client.post(
        "/opportunities",
        json={"title": "Spoof attempt", "organization_id": two_orgs.org_b_id},
        headers=_auth(admin_a_token),
    )

    assert response.status_code == 201
    assert response.json()["organization_id"] == two_orgs.org_a_id
