"""Catalogue items tests: active filtering, tenant isolation, and read permissions."""

from collections.abc import Callable
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalogue_item import CatalogueItem
from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_unauthenticated_catalogue_request_returns_401(client: TestClient) -> None:
    response = client.get("/catalogue/items")
    assert response.status_code == 401


def test_list_catalogue_items_returns_active_only(
    client: TestClient,
    two_orgs: TwoOrgs,
    db_session: Session,
    login: Callable[[str], str],
) -> None:
    # Directly seed an active and an inactive item in Org A
    active_item = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="package",
        name="Active Package",
        category="electric_city",
        base_monthly_estimate=Decimal("649.00"),
        active=True,
    )
    inactive_item = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="package",
        name="Retired Package",
        category="electric_city",
        base_monthly_estimate=Decimal("499.00"),
        active=False,
    )
    db_session.add_all([active_item, inactive_item])
    db_session.commit()

    token = login(two_orgs.viewer_a)
    response = client.get("/catalogue/items", headers=_auth(token))

    assert response.status_code == 200
    items = response.json()
    names = [item["name"] for item in items]
    assert "Active Package" in names
    assert "Retired Package" not in names


def test_catalogue_items_are_scoped_to_own_org(
    client: TestClient,
    two_orgs: TwoOrgs,
    db_session: Session,
    login: Callable[[str], str],
) -> None:
    item_a = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="package",
        name="Org A Only Package",
        category="hybrid",
        base_monthly_estimate=Decimal("549.00"),
        active=True,
    )
    item_b = CatalogueItem(
        organization_id=two_orgs.org_b_id,
        type="package",
        name="Org B Only Package",
        category="long_distance",
        base_monthly_estimate=Decimal("729.00"),
        active=True,
    )
    db_session.add_all([item_a, item_b])
    db_session.commit()

    token_a = login(two_orgs.admin_a)
    res_a = client.get("/catalogue/items", headers=_auth(token_a))
    assert res_a.status_code == 200
    names_a = [i["name"] for i in res_a.json()]
    assert "Org A Only Package" in names_a
    assert "Org B Only Package" not in names_a

    token_b = login(two_orgs.admin_b)
    res_b = client.get("/catalogue/items", headers=_auth(token_b))
    assert res_b.status_code == 200
    names_b = [i["name"] for i in res_b.json()]
    assert "Org B Only Package" in names_b
    assert "Org A Only Package" not in names_b


@pytest.mark.parametrize("role_attr", ["admin_a", "manager_a", "approver_a", "viewer_a"])
def test_every_role_can_view_catalogue(
    client: TestClient,
    two_orgs: TwoOrgs,
    db_session: Session,
    login: Callable[[str], str],
    role_attr: str,
) -> None:
    item = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="add_on",
        name="Maintenance Service",
        category="maintenance",
        base_monthly_estimate=Decimal("89.00"),
        active=True,
    )
    db_session.add(item)
    db_session.commit()

    token = login(getattr(two_orgs, role_attr))
    response = client.get("/catalogue/items", headers=_auth(token))
    assert response.status_code == 200
    assert any(i["name"] == "Maintenance Service" for i in response.json())


def test_catalogue_item_response_fields(
    client: TestClient,
    two_orgs: TwoOrgs,
    db_session: Session,
    login: Callable[[str], str],
) -> None:
    item = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="add_on",
        name="Roadside Assistance",
        category="roadside_assistance",
        base_monthly_estimate=Decimal("19.00"),
        active=True,
    )
    db_session.add(item)
    db_session.commit()

    token = login(two_orgs.manager_a)
    response = client.get("/catalogue/items", headers=_auth(token))
    assert response.status_code == 200
    matching = [i for i in response.json() if i["name"] == "Roadside Assistance"]
    assert len(matching) == 1
    record = matching[0]
    assert record["organization_id"] == two_orgs.org_a_id
    assert record["type"] == "add_on"
    assert record["category"] == "roadside_assistance"
    assert Decimal(str(record["base_monthly_estimate"])) == Decimal("19.00")
    assert record["active"] is True
