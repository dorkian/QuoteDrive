"""Integration tests for POST /estimates/calculate endpoint."""

from collections.abc import Callable
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalogue_item import CatalogueItem
from app.services.estimate_service import ILLUSTRATIVE_DISCLAIMER
from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def seeded_catalogue(db_session: Session, two_orgs: TwoOrgs) -> dict[str, CatalogueItem]:
    pkg_a = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="package",
        name="Electric City",
        category="electric_city",
        base_monthly_estimate=Decimal("649.00"),
        active=True,
    )
    addon_maint_a = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="add_on",
        name="Maintenance",
        category="maintenance",
        base_monthly_estimate=Decimal("89.00"),
        active=True,
    )
    addon_tyres_a = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="add_on",
        name="Tyres",
        category="tyres",
        base_monthly_estimate=Decimal("35.00"),
        active=True,
    )
    inactive_pkg_a = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="package",
        name="Retired Package",
        category="electric_city",
        base_monthly_estimate=Decimal("500.00"),
        active=False,
    )
    inactive_addon_a = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="add_on",
        name="Retired Add-on",
        category="maintenance",
        base_monthly_estimate=Decimal("50.00"),
        active=False,
    )
    pkg_b = CatalogueItem(
        organization_id=two_orgs.org_b_id,
        type="package",
        name="Org B Package",
        category="hybrid",
        base_monthly_estimate=Decimal("549.00"),
        active=True,
    )
    db_session.add_all([pkg_a, addon_maint_a, addon_tyres_a, inactive_pkg_a, inactive_addon_a, pkg_b])
    db_session.commit()
    for item in [pkg_a, addon_maint_a, addon_tyres_a, inactive_pkg_a, inactive_addon_a, pkg_b]:
        db_session.refresh(item)
    return {
        "pkg_a": pkg_a,
        "addon_maint_a": addon_maint_a,
        "addon_tyres_a": addon_tyres_a,
        "inactive_pkg_a": inactive_pkg_a,
        "inactive_addon_a": inactive_addon_a,
        "pkg_b": pkg_b,
    }


def test_unauthenticated_calculate_returns_401(client: TestClient) -> None:
    response = client.post("/estimates/calculate", json={"lines": []})
    assert response.status_code == 401


def test_calculate_estimate_happy_path(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_catalogue: dict[str, CatalogueItem],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    pkg = seeded_catalogue["pkg_a"]
    maint = seeded_catalogue["addon_maint_a"]
    tyres = seeded_catalogue["addon_tyres_a"]

    # 4 vehicles: 649 + 89 + 35 = 773 * 4 = 3092.00
    payload = {
        "lines": [
            {
                "catalogue_item_id": pkg.id,
                "quantity": 4,
                "add_on_item_ids": [maint.id, tyres.id],
            }
        ]
    }
    response = client.post("/estimates/calculate", json=payload, headers=_auth(token))

    assert response.status_code == 200
    data = response.json()
    assert len(data["lines"]) == 1
    line = data["lines"][0]
    assert line["catalogue_item_id"] == pkg.id
    assert line["name"] == "Electric City"
    assert line["category"] == "electric_city"
    assert line["quantity"] == 4
    assert Decimal(str(line["unit_estimate"])) == Decimal("773.00")
    assert Decimal(str(line["line_total"])) == Decimal("3092.00")
    assert Decimal(str(data["total_estimate"])) == Decimal("3092.00")
    assert data["disclaimer"] == ILLUSTRATIVE_DISCLAIMER


def test_calculate_estimate_zero_quantity(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_catalogue: dict[str, CatalogueItem],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.admin_a)
    pkg = seeded_catalogue["pkg_a"]

    payload = {
        "lines": [
            {
                "catalogue_item_id": pkg.id,
                "quantity": 0,
                "add_on_item_ids": [],
            }
        ]
    }
    response = client.post("/estimates/calculate", json=payload, headers=_auth(token))

    assert response.status_code == 200
    data = response.json()
    assert Decimal(str(data["lines"][0]["line_total"])) == Decimal("0")
    assert Decimal(str(data["total_estimate"])) == Decimal("0")


def test_calculate_estimate_inactive_package_returns_404(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_catalogue: dict[str, CatalogueItem],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    payload = {
        "lines": [
            {
                "catalogue_item_id": seeded_catalogue["inactive_pkg_a"].id,
                "quantity": 1,
            }
        ]
    }
    response = client.post("/estimates/calculate", json=payload, headers=_auth(token))
    assert response.status_code == 404


def test_calculate_estimate_inactive_add_on_returns_404(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_catalogue: dict[str, CatalogueItem],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    payload = {
        "lines": [
            {
                "catalogue_item_id": seeded_catalogue["pkg_a"].id,
                "quantity": 1,
                "add_on_item_ids": [seeded_catalogue["inactive_addon_a"].id],
            }
        ]
    }
    response = client.post("/estimates/calculate", json=payload, headers=_auth(token))
    assert response.status_code == 404


def test_calculate_estimate_cross_tenant_item_returns_404(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_catalogue: dict[str, CatalogueItem],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    payload = {
        "lines": [
            {
                "catalogue_item_id": seeded_catalogue["pkg_b"].id,
                "quantity": 1,
            }
        ]
    }
    response = client.post("/estimates/calculate", json=payload, headers=_auth(token))
    assert response.status_code == 404


def test_calculate_estimate_add_on_as_primary_package_returns_404(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_catalogue: dict[str, CatalogueItem],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    payload = {
        "lines": [
            {
                "catalogue_item_id": seeded_catalogue["addon_maint_a"].id,
                "quantity": 1,
            }
        ]
    }
    response = client.post("/estimates/calculate", json=payload, headers=_auth(token))
    assert response.status_code == 404


def test_calculate_estimate_package_as_add_on_returns_404(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_catalogue: dict[str, CatalogueItem],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    payload = {
        "lines": [
            {
                "catalogue_item_id": seeded_catalogue["pkg_a"].id,
                "quantity": 1,
                "add_on_item_ids": [seeded_catalogue["pkg_a"].id],
            }
        ]
    }
    response = client.post("/estimates/calculate", json=payload, headers=_auth(token))
    assert response.status_code == 404


@pytest.mark.parametrize("role_attr", ["admin_a", "manager_a"])
def test_admin_and_manager_can_calculate_estimates(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_catalogue: dict[str, CatalogueItem],
    login: Callable[[str], str],
    role_attr: str,
) -> None:
    token = login(getattr(two_orgs, role_attr))
    payload = {"lines": [{"catalogue_item_id": seeded_catalogue["pkg_a"].id, "quantity": 1}]}
    response = client.post("/estimates/calculate", json=payload, headers=_auth(token))
    assert response.status_code == 200


@pytest.mark.parametrize("role_attr", ["approver_a", "viewer_a"])
def test_approver_and_viewer_cannot_calculate_estimates(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_catalogue: dict[str, CatalogueItem],
    login: Callable[[str], str],
    role_attr: str,
) -> None:
    token = login(getattr(two_orgs, role_attr))
    payload = {"lines": [{"catalogue_item_id": seeded_catalogue["pkg_a"].id, "quantity": 1}]}
    response = client.post("/estimates/calculate", json=payload, headers=_auth(token))
    assert response.status_code == 403

