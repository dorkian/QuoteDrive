"""Integration tests for proposal versions: creation, immutability, FSM transitions, and RBAC."""

from collections.abc import Callable
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.catalogue_item import CatalogueItem
from app.models.opportunity import Opportunity
from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def seeded_env(db_session: Session, two_orgs: TwoOrgs) -> dict[str, int]:
    opp_a = Opportunity(
        organization_id=two_orgs.org_a_id,
        customer_id=two_orgs.customer_a_id,
        owner_id=1,
        title="Org A Opportunity",
        status="open",
    )
    opp_b = Opportunity(
        organization_id=two_orgs.org_b_id,
        customer_id=two_orgs.customer_b_id,
        owner_id=5,
        title="Org B Opportunity",
        status="open",
    )
    pkg = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="package",
        name="Electric City",
        category="electric_city",
        base_monthly_estimate=Decimal("649.00"),
        active=True,
    )
    addon = CatalogueItem(
        organization_id=two_orgs.org_a_id,
        type="add_on",
        name="Maintenance",
        category="maintenance",
        base_monthly_estimate=Decimal("89.00"),
        active=True,
    )
    db_session.add_all([opp_a, opp_b, pkg, addon])
    db_session.commit()
    db_session.refresh(opp_a)
    db_session.refresh(opp_b)
    db_session.refresh(pkg)
    db_session.refresh(addon)

    return {
        "opp_a_id": opp_a.id,
        "opp_b_id": opp_b.id,
        "pkg_id": pkg.id,
        "addon_id": addon.id,
    }


def test_unauthenticated_request_returns_401(client: TestClient) -> None:
    assert client.post("/opportunities/1/versions", json={}).status_code == 401
    assert client.get("/proposal-versions/1").status_code == 401
    assert client.patch("/proposal-versions/1", json={"lines": []}).status_code == 401
    assert client.post("/proposal-versions/1/finalize").status_code == 401


def test_create_initial_draft_version(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    response = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["version_number"] == 1
    assert data["status"] == "draft"
    assert data["content_json"] == {"lines": []}
    assert Decimal(str(data["total_estimate"])) == Decimal(0)
    assert data["opportunity_id"] == seeded_env["opp_a_id"]
    assert data["organization_id"] == two_orgs.org_a_id


def test_create_subsequent_version_increments_version_number(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    v1 = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    ).json()
    assert v1["version_number"] == 1

    v2 = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    ).json()
    assert v2["version_number"] == 2


def test_patch_draft_version_updates_content_and_status(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    v1 = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    ).json()

    # 4 vehicles: (649 + 89) * 4 = 2952.00
    patch_payload = {
        "lines": [
            {
                "catalogue_item_id": seeded_env["pkg_id"],
                "quantity": 4,
                "add_on_item_ids": [seeded_env["addon_id"]],
            }
        ]
    }
    patched = client.patch(
        f"/proposal-versions/{v1['id']}",
        json=patch_payload,
        headers=_auth(token),
    )

    assert patched.status_code == 200
    data = patched.json()
    assert data["status"] == "configured"
    assert Decimal(str(data["total_estimate"])) == Decimal("2952.00")
    assert len(data["content_json"]["lines"]) == 1


def test_patch_persists_assumptions_per_line(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    v1 = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    ).json()

    patch_payload = {
        "lines": [
            {
                "catalogue_item_id": seeded_env["pkg_id"],
                "quantity": 4,
                "add_on_item_ids": [],
                "assumptions": "12-month term, standard mileage",
            }
        ]
    }
    patched = client.patch(
        f"/proposal-versions/{v1['id']}",
        json=patch_payload,
        headers=_auth(token),
    )

    assert patched.status_code == 200
    line = patched.json()["content_json"]["lines"][0]
    assert line["assumptions"] == "12-month term, standard mileage"


def test_finalize_version_transitions_to_proposal_drafted(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    v1 = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    ).json()

    finalized = client.post(
        f"/proposal-versions/{v1['id']}/finalize",
        headers=_auth(token),
    )

    assert finalized.status_code == 200
    assert finalized.json()["status"] == "proposal_drafted"


def test_patch_finalized_version_returns_400_immutable(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    v1 = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    ).json()
    client.post(f"/proposal-versions/{v1['id']}/finalize", headers=_auth(token))

    # Attempt to patch frozen version
    response = client.patch(
        f"/proposal-versions/{v1['id']}",
        json={"lines": []},
        headers=_auth(token),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Version is immutable"


def test_finalize_already_finalized_version_returns_400(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    v1 = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    ).json()
    client.post(f"/proposal-versions/{v1['id']}/finalize", headers=_auth(token))

    response = client.post(f"/proposal-versions/{v1['id']}/finalize", headers=_auth(token))
    assert response.status_code == 400
    assert response.json()["detail"] == "Version is immutable"


def test_fork_version_via_from_version_id(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    v1 = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    ).json()

    patch_payload = {
        "lines": [
            {
                "catalogue_item_id": seeded_env["pkg_id"],
                "quantity": 4,
                "add_on_item_ids": [seeded_env["addon_id"]],
            }
        ]
    }
    patched_v1 = client.patch(
        f"/proposal-versions/{v1['id']}", json=patch_payload, headers=_auth(token)
    ).json()
    client.post(f"/proposal-versions/{v1['id']}/finalize", headers=_auth(token))

    # Fork new draft from frozen v1
    v2 = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={"from_version_id": v1["id"]},
        headers=_auth(token),
    ).json()

    assert v2["version_number"] == 2
    assert v2["status"] == "draft"
    assert Decimal(str(v2["total_estimate"])) == Decimal("2952.00")
    assert v2["content_json"] == patched_v1["content_json"]


def test_cross_tenant_opportunity_version_create_returns_404(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    response = client.post(
        f"/opportunities/{seeded_env['opp_b_id']}/versions",
        json={},
        headers=_auth(token),
    )
    assert response.status_code == 404


def test_cross_tenant_from_version_id_returns_404(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token_b = login(two_orgs.admin_b)
    v_b = client.post(
        f"/opportunities/{seeded_env['opp_b_id']}/versions",
        json={},
        headers=_auth(token_b),
    ).json()

    token_a = login(two_orgs.manager_a)
    response = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={"from_version_id": v_b["id"]},
        headers=_auth(token_a),
    )
    assert response.status_code == 404


def test_cross_tenant_get_patch_finalize_returns_404(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token_a = login(two_orgs.manager_a)
    v_a = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token_a),
    ).json()

    token_b = login(two_orgs.admin_b)
    assert client.get(f"/proposal-versions/{v_a['id']}", headers=_auth(token_b)).status_code == 404
    assert (
        client.patch(
            f"/proposal-versions/{v_a['id']}",
            json={"lines": []},
            headers=_auth(token_b),
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/proposal-versions/{v_a['id']}/finalize",
            headers=_auth(token_b),
        ).status_code
        == 404
    )


@pytest.mark.parametrize("role_attr", ["admin_a", "manager_a"])
def test_admin_and_manager_can_create_patch_finalize(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
    role_attr: str,
) -> None:
    token = login(getattr(two_orgs, role_attr))
    created = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    )
    assert created.status_code == 201

    patched = client.patch(
        f"/proposal-versions/{created.json()['id']}",
        json={"lines": []},
        headers=_auth(token),
    )
    assert patched.status_code == 200

    finalized = client.post(
        f"/proposal-versions/{created.json()['id']}/finalize",
        headers=_auth(token),
    )
    assert finalized.status_code == 200


@pytest.mark.parametrize("role_attr", ["approver_a", "viewer_a"])
def test_approver_and_viewer_cannot_create_patch_finalize_but_can_get(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
    role_attr: str,
) -> None:
    admin_token = login(two_orgs.admin_a)
    created = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(admin_token),
    ).json()

    token = login(getattr(two_orgs, role_attr))

    # Cannot create
    res_create = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    )
    assert res_create.status_code == 403

    # Cannot patch
    res_patch = client.patch(
        f"/proposal-versions/{created['id']}",
        json={"lines": []},
        headers=_auth(token),
    )
    assert res_patch.status_code == 403

    # Cannot finalize
    res_finalize = client.post(
        f"/proposal-versions/{created['id']}/finalize",
        headers=_auth(token),
    )
    assert res_finalize.status_code == 403

    # But CAN view
    res_get = client.get(f"/proposal-versions/{created['id']}", headers=_auth(token))
    assert res_get.status_code == 200


def test_list_versions_for_opportunity_ordered_most_recent_first(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    v1 = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    ).json()
    v2 = client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token),
    ).json()

    response = client.get(f"/opportunities/{seeded_env['opp_a_id']}/versions", headers=_auth(token))

    assert response.status_code == 200
    versions = response.json()
    assert [v["id"] for v in versions] == [v2["id"], v1["id"]]


def test_list_versions_is_scoped_to_own_org(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token_a = login(two_orgs.manager_a)
    client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(token_a),
    )

    token_b = login(two_orgs.admin_b)
    response = client.get(
        f"/opportunities/{seeded_env['opp_b_id']}/versions", headers=_auth(token_b)
    )

    assert response.status_code == 200
    assert response.json() == []


def test_list_versions_cross_tenant_opportunity_returns_404(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.manager_a)
    response = client.get(f"/opportunities/{seeded_env['opp_b_id']}/versions", headers=_auth(token))
    assert response.status_code == 404


@pytest.mark.parametrize("role_attr", ["admin_a", "manager_a", "approver_a", "viewer_a"])
def test_every_role_can_list_versions(
    client: TestClient,
    two_orgs: TwoOrgs,
    seeded_env: dict[str, int],
    login: Callable[[str], str],
    role_attr: str,
) -> None:
    admin_token = login(two_orgs.admin_a)
    client.post(
        f"/opportunities/{seeded_env['opp_a_id']}/versions",
        json={},
        headers=_auth(admin_token),
    )

    token = login(getattr(two_orgs, role_attr))
    response = client.get(f"/opportunities/{seeded_env['opp_a_id']}/versions", headers=_auth(token))
    assert response.status_code == 200
