"""Tenant AI settings: read by all, changed by Admins (QD-417)."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from tests.conftest import TwoOrgs


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize("who", ["admin_a", "manager_a", "approver_a", "viewer_a"])
def test_every_role_reads_the_settings(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], who: str
) -> None:
    response = client.get("/organization/settings", headers=_auth(login(getattr(two_orgs, who))))

    assert response.status_code == 200
    assert response.json() == {"ai_fallback_enabled": False, "ai_fallback_available": False}


def test_availability_reflects_the_deployment(
    client: TestClient,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "AI_PROVIDER", "openrouter")
    monkeypatch.setattr(settings, "AI_FALLBACK_PROVIDER", "ollama")

    response = client.get("/organization/settings", headers=_auth(login(two_orgs.viewer_a)))

    assert response.json()["ai_fallback_available"] is True


def test_admin_enables_fallback_for_their_org_only_and_it_is_audited(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)

    response = client.patch(
        "/organization/settings", json={"ai_fallback_enabled": True}, headers=_auth(admin)
    )

    assert response.status_code == 200
    assert response.json()["ai_fallback_enabled"] is True
    other = client.get("/organization/settings", headers=_auth(login(two_orgs.admin_b))).json()
    assert other["ai_fallback_enabled"] is False
    events = client.get(
        "/audit-events", params={"entity_type": "organization"}, headers=_auth(admin)
    ).json()
    assert len(events) == 1
    assert events[0]["action"] == "update_settings"
    assert events[0]["before_json"] == {"ai_fallback_enabled": False}
    assert events[0]["after_json"] == {"ai_fallback_enabled": True}


def test_unchanged_setting_records_no_audit_event(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    admin = login(two_orgs.admin_a)

    client.patch(
        "/organization/settings", json={"ai_fallback_enabled": False}, headers=_auth(admin)
    )

    events = client.get(
        "/audit-events", params={"entity_type": "organization"}, headers=_auth(admin)
    ).json()
    assert events == []


@pytest.mark.parametrize("who", ["manager_a", "approver_a", "viewer_a"])
def test_non_admins_cannot_change_settings(
    client: TestClient, two_orgs: TwoOrgs, login: Callable[[str], str], who: str
) -> None:
    response = client.patch(
        "/organization/settings",
        json={"ai_fallback_enabled": True},
        headers=_auth(login(getattr(two_orgs, who))),
    )

    assert response.status_code == 403
