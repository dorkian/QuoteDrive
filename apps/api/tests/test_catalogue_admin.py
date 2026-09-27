"""Admin catalogue management: create, edit, deactivate (QD-415)."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TwoOrgs

PACKAGE = {
    "type": "package",
    "name": "Cargo Van",
    "category": "commercial",
    "base_monthly_estimate": "812.50",
}


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create(client: TestClient, token: str, **overrides: Any) -> dict[str, Any]:
    response = client.post("/catalogue/items", json={**PACKAGE, **overrides}, headers=_auth(token))
    assert response.status_code == 201, response.text
    item: dict[str, Any] = response.json()
    return item


def test_admin_creates_an_item_and_it_is_audited(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)

    item = _create(client, admin, name="  Cargo Van  ")

    assert item["name"] == "Cargo Van"
    assert item["base_monthly_estimate"] == "812.50"
    assert item["active"] is True
    assert item["organization_id"] == two_orgs.org_a_id
    events = client.get(
        "/audit-events",
        params={"entity_type": "catalogue_item", "entity_id": item["id"]},
        headers=_auth(admin),
    ).json()
    assert [e["action"] for e in events] == ["create"]


@pytest.mark.parametrize("who", ["manager_a", "approver_a", "viewer_a"])
def test_only_admins_manage_the_catalogue(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], who: str
) -> None:
    item = _create(client, login(two_orgs.admin_a))
    token = login(getattr(two_orgs, who))

    assert client.post("/catalogue/items", json=PACKAGE, headers=_auth(token)).status_code == 403
    patch = client.patch(
        f"/catalogue/items/{item['id']}", json={"active": False}, headers=_auth(token)
    )
    assert patch.status_code == 403
    listing = client.get(
        "/catalogue/items", params={"include_inactive": True}, headers=_auth(token)
    )
    assert listing.status_code == 403


def test_other_tenants_item_is_not_found(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    item = _create(client, login(two_orgs.admin_b))

    response = client.patch(
        f"/catalogue/items/{item['id']}",
        json={"name": "Hijacked"},
        headers=_auth(login(two_orgs.admin_a)),
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "overrides",
    [
        {"base_monthly_estimate": "-1.00"},
        {"base_monthly_estimate": "10.001"},
        {"type": "bundle"},
        {"name": "   "},
        {"category": ""},
    ],
)
def test_invalid_items_are_rejected(
    client: TestClient,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    overrides: dict[str, str],
) -> None:
    response = client.post(
        "/catalogue/items", json={**PACKAGE, **overrides}, headers=_auth(login(two_orgs.admin_a))
    )

    assert response.status_code == 422


def test_type_cannot_change_and_negative_price_edit_is_rejected(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)
    item = _create(client, admin)

    ignored = client.patch(
        f"/catalogue/items/{item['id']}", json={"type": "add_on"}, headers=_auth(admin)
    )
    negative = client.patch(
        f"/catalogue/items/{item['id']}",
        json={"base_monthly_estimate": "-5"},
        headers=_auth(admin),
    )

    assert ignored.status_code == 200
    assert ignored.json()["type"] == "package"
    assert negative.status_code == 422


def test_deactivated_items_are_hidden_and_cannot_be_quoted(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)
    item = _create(client, admin)

    response = client.patch(
        f"/catalogue/items/{item['id']}", json={"active": False}, headers=_auth(admin)
    )

    assert response.json()["active"] is False
    manager = login(two_orgs.manager_a)
    active_ids = [i["id"] for i in client.get("/catalogue/items", headers=_auth(manager)).json()]
    assert item["id"] not in active_ids
    all_ids = [
        i["id"]
        for i in client.get(
            "/catalogue/items", params={"include_inactive": True}, headers=_auth(admin)
        ).json()
    ]
    assert item["id"] in all_ids
    quote = client.post(
        "/estimates/calculate",
        json={"lines": [{"catalogue_item_id": item["id"], "quantity": 1, "add_on_item_ids": []}]},
        headers=_auth(manager),
    )
    assert quote.status_code == 404
    events = client.get(
        "/audit-events",
        params={"entity_type": "catalogue_item", "entity_id": item["id"]},
        headers=_auth(admin),
    ).json()
    assert events[0]["action"] == "update"
    assert events[0]["before_json"]["active"] is True
    assert events[0]["after_json"]["active"] is False


def test_editing_an_item_leaves_saved_versions_unchanged(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)
    manager = login(two_orgs.manager_a)
    item = _create(client, admin)
    opportunity = client.post(
        "/opportunities",
        json={"customer_id": two_orgs.customer_a_id, "title": "Snapshot check"},
        headers=_auth(manager),
    ).json()
    version = client.post(
        f"/opportunities/{opportunity['id']}/versions", json={}, headers=_auth(manager)
    ).json()
    saved = client.patch(
        f"/proposal-versions/{version['id']}",
        json={
            "lines": [
                {
                    "catalogue_item_id": item["id"],
                    "quantity": 2,
                    "add_on_item_ids": [],
                    "assumptions": None,
                }
            ]
        },
        headers=_auth(manager),
    )
    assert saved.status_code == 200, saved.text

    client.patch(
        f"/catalogue/items/{item['id']}",
        json={"base_monthly_estimate": "999.00", "name": "Renamed Van", "active": False},
        headers=_auth(admin),
    )

    after = client.get(f"/proposal-versions/{version['id']}", headers=_auth(manager)).json()
    assert after["total_estimate"] == "1625.00"
    line = after["content_json"]["lines"][0]
    assert line["name"] == "Cargo Van"
    assert line["unit_estimate"] == "812.50"


def test_no_op_update_records_no_audit_event(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)
    item = _create(client, admin)

    client.patch(f"/catalogue/items/{item['id']}", json={"name": "Cargo Van"}, headers=_auth(admin))

    events = client.get(
        "/audit-events",
        params={"entity_type": "catalogue_item", "entity_id": item["id"]},
        headers=_auth(admin),
    ).json()
    assert [e["action"] for e in events] == ["create"]
