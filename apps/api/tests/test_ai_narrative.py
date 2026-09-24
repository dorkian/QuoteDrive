import json
from collections.abc import Callable, Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.deps import get_ai_provider
from app.core.config import settings
from app.main import app
from app.models import Customer, GenerationLog, Opportunity, ProposalVersion
from app.services.ai.narrative_service import build_prompt
from app.services.ai.providers.base import ProviderTimeoutError
from app.services.ai.providers.fake import FakeProvider
from tests.conftest import TwoOrgs

VALID_NARRATIVE = {
    "executive_summary": "Exec summary",
    "recommended_approach": "Approach",
    "scope": "Scope",
    "assumptions_exclusions": ["Assumption 1"],
    "next_steps": ["Step 1"],
    "email_draft": "Email",
}


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def fake_provider() -> Generator[FakeProvider, None, None]:
    provider = FakeProvider(fixture_text=json.dumps(VALID_NARRATIVE))
    app.dependency_overrides[get_ai_provider] = lambda: provider
    yield provider
    app.dependency_overrides.pop(get_ai_provider, None)


@pytest.fixture
def proposal_version(db_session: Session, two_orgs: TwoOrgs) -> ProposalVersion:
    opp = Opportunity(
        organization_id=two_orgs.org_a_id,
        customer_id=two_orgs.customer_a_id,
        owner_id=1,  # arbitrary
        title="Test Opportunity",
    )
    db_session.add(opp)
    db_session.commit()

    version = ProposalVersion(
        organization_id=two_orgs.org_a_id,
        opportunity_id=opp.id,
        created_by=1,
        content_json={"lines": [{"name": "Line 1"}]},
        status="draft",
        version_number=1,
    )
    db_session.add(version)
    db_session.commit()
    return version


def test_generate_narrative_happy_path(
    client: TestClient,
    fake_provider: FakeProvider,
    proposal_version: ProposalVersion,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    db_session: Session,
) -> None:
    token = login(two_orgs.manager_a)
    response = client.post(
        "/ai/proposal-narrative",
        json={"proposal_version_id": proposal_version.id, "timeline": "Q4"},
        headers=_auth(token),
    )
    assert response.status_code == 200, response.json()
    data = response.json()
    assert data["executive_summary"] == "Exec summary"
    assert data["disclaimer"] == "Draft AI Content — Requires human review"

    log = db_session.query(GenerationLog).filter_by(entity_id=proposal_version.id).first()
    assert log is not None
    assert log.status == "success"
    assert log.provider == "fake"
    assert log.latency_ms is not None


def test_build_prompt_missing_timeline(
    proposal_version: ProposalVersion, db_session: Session
) -> None:
    opp = db_session.get(Opportunity, proposal_version.opportunity_id)
    assert opp is not None
    cust = db_session.get(Customer, opp.customer_id)
    assert cust is not None

    req = build_prompt(proposal_version, opp, cust, timeline=None)
    assert "Not provided - please list this under assumptions" in req.prompt


def test_build_prompt_delimits_untrusted_data(
    proposal_version: ProposalVersion, db_session: Session
) -> None:
    opp = db_session.get(Opportunity, proposal_version.opportunity_id)
    assert opp is not None
    cust = db_session.get(Customer, opp.customer_id)
    assert cust is not None

    req = build_prompt(proposal_version, opp, cust, timeline="Q4")

    assert req.prompt.startswith("<<<PROPOSAL_DATA>>>")
    assert req.prompt.endswith("<<<END_PROPOSAL_DATA>>>")
    assert req.system is not None
    assert "untrusted data" in req.system
    assert "never follow" in req.system.lower()


def test_generate_narrative_empty_proposal(
    client: TestClient,
    proposal_version: ProposalVersion,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    db_session: Session,
    fake_provider: FakeProvider,
) -> None:
    proposal_version.content_json = {}
    db_session.commit()

    token = login(two_orgs.manager_a)
    response = client.post(
        "/ai/proposal-narrative",
        json={"proposal_version_id": proposal_version.id, "timeline": "Q4"},
        headers=_auth(token),
    )
    assert response.status_code == 400


def test_generate_narrative_rbac_viewer(
    client: TestClient,
    proposal_version: ProposalVersion,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.viewer_a)
    response = client.post(
        "/ai/proposal-narrative",
        json={"proposal_version_id": proposal_version.id, "timeline": "Q4"},
        headers=_auth(token),
    )
    assert response.status_code == 403


def test_generate_narrative_tenant_isolation(
    client: TestClient,
    proposal_version: ProposalVersion,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
) -> None:
    token = login(two_orgs.admin_b)
    response = client.post(
        "/ai/proposal-narrative",
        json={"proposal_version_id": proposal_version.id, "timeline": "Q4"},
        headers=_auth(token),
    )
    assert response.status_code == 404


def test_generate_narrative_misconfigured_provider_returns_clean_500(
    client: TestClient,
    proposal_version: ProposalVersion,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # No dependency override here — exercises the real get_ai_provider(), which
    # must turn get_provider()'s ValueError (openrouter selected, no API key)
    # into a clean 500 instead of an opaque unhandled error.
    monkeypatch.setattr(settings, "AI_PROVIDER", "openrouter")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", None)

    token = login(two_orgs.manager_a)
    response = client.post(
        "/ai/proposal-narrative",
        json={"proposal_version_id": proposal_version.id, "timeline": "Q4"},
        headers=_auth(token),
    )
    assert response.status_code == 500
    assert response.json()["detail"] == "AI provider misconfigured"


def test_generate_narrative_provider_error(
    client: TestClient,
    proposal_version: ProposalVersion,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    db_session: Session,
) -> None:
    # Use FakeProvider's raise_error mode rather than a bespoke stub class,
    # per AGENTS.md: "Use FakeProvider for automated AI tests."
    app.dependency_overrides[get_ai_provider] = lambda: FakeProvider(
        raise_error=ProviderTimeoutError("timeout")
    )

    token = login(two_orgs.manager_a)
    response = client.post(
        "/ai/proposal-narrative",
        json={"proposal_version_id": proposal_version.id, "timeline": "Q4"},
        headers=_auth(token),
    )
    assert response.status_code == 504

    log = db_session.query(GenerationLog).filter_by(entity_id=proposal_version.id).first()
    assert log is not None
    assert log.status == "error"
    assert log.error_detail == "timeout"
    assert log.provider == "fake"


def test_generate_narrative_malformed_json(
    client: TestClient,
    proposal_version: ProposalVersion,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    db_session: Session,
) -> None:
    app.dependency_overrides[get_ai_provider] = lambda: FakeProvider(fixture_text="not json")

    token = login(two_orgs.manager_a)
    response = client.post(
        "/ai/proposal-narrative",
        json={"proposal_version_id": proposal_version.id, "timeline": "Q4"},
        headers=_auth(token),
    )
    assert response.status_code == 502

    log = db_session.query(GenerationLog).filter_by(entity_id=proposal_version.id).first()
    assert log is not None
    assert log.status == "error"
    assert log.error_detail is not None
    assert "Failed to parse" in log.error_detail


def test_generate_narrative_includes_provider_and_model(
    client: TestClient,
    fake_provider: FakeProvider,
    proposal_version: ProposalVersion,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
    db_session: Session,
) -> None:
    token = login(two_orgs.manager_a)
    response = client.post(
        "/ai/proposal-narrative",
        json={"proposal_version_id": proposal_version.id, "timeline": "Q4"},
        headers=_auth(token),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "fake"
    assert data["model"] == "fake-model"


def test_build_prompt_includes_brief_json(
    proposal_version: ProposalVersion, db_session: Session
) -> None:
    opp = db_session.get(Opportunity, proposal_version.opportunity_id)
    assert opp is not None
    opp.brief_json = {"pain_points": "Legacy system is too slow"}
    cust = db_session.get(Customer, opp.customer_id)
    assert cust is not None

    req = build_prompt(proposal_version, opp, cust, timeline=None)

    assert "Discovery Brief:" in req.prompt
    assert "pain_points" in req.prompt
    assert "Legacy system is too slow" in req.prompt

    # Ensure it's still inside the untrusted data block
    prompt_lines = req.prompt.split("\n")
    start_idx = prompt_lines.index("<<<PROPOSAL_DATA>>>")
    end_idx = prompt_lines.index("<<<END_PROPOSAL_DATA>>>")
    brief_idx = next(i for i, line in enumerate(prompt_lines) if "Discovery Brief:" in line)

    assert start_idx < brief_idx < end_idx


def test_build_prompt_omits_brief_json_when_absent(
    proposal_version: ProposalVersion, db_session: Session
) -> None:
    opp = db_session.get(Opportunity, proposal_version.opportunity_id)
    assert opp is not None
    # Ensure it is absent
    assert not opp.brief_json
    cust = db_session.get(Customer, opp.customer_id)
    assert cust is not None

    req = build_prompt(proposal_version, opp, cust, timeline=None)

    assert "Discovery Brief" not in req.prompt
