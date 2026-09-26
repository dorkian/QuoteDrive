import json
from collections.abc import Callable, Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.deps import get_ai_provider
from app.main import app
from app.models import GenerationLog, Opportunity
from app.services.ai.providers.base import ProviderTimeoutError
from app.services.ai.providers.fake import FakeProvider
from tests.conftest import TwoOrgs

VALID_BRIEF = {
    "summary": "Operator of 12 vans wants to go electric.",
    "requirements": ["Electric vans"],
    "open_questions": ["Which models?"],
    "unknowns": ["Budget range"],
}
NOTES = "They run 12 delivery vans and want to go electric."


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _use(provider: FakeProvider) -> None:
    app.dependency_overrides[get_ai_provider] = lambda: provider


@pytest.fixture(autouse=True)
def _clear_provider() -> Generator[None, None, None]:
    yield
    app.dependency_overrides.pop(get_ai_provider, None)


def _opportunity(db: Session, org_id: int, customer_id: int) -> Opportunity:
    opp = Opportunity(
        organization_id=org_id,
        customer_id=customer_id,
        owner_id=1,
        title="Fleet",
        brief_json={"summary": "Saved brief"},
    )
    db.add(opp)
    db.commit()
    return opp


def test_drafts_brief_without_saving_it(
    client: TestClient, db_session: Session, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    opp = _opportunity(db_session, two_orgs.org_a_id, two_orgs.customer_a_id)
    _use(FakeProvider(fixture_text=json.dumps(VALID_BRIEF)))

    response = client.post(
        "/ai/discovery-brief",
        json={"opportunity_id": opp.id, "notes": NOTES},
        headers=_auth(login(two_orgs.manager_a)),
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["unknowns"] == ["Budget range"]
    assert data["disclaimer"] == "Draft AI Content — Requires human review"
    assert (data["provider"], data["model"]) == ("fake", "fake-model")
    db_session.refresh(opp)
    assert opp.brief_json == {"summary": "Saved brief"}
    log = db_session.query(GenerationLog).filter_by(entity_type="opportunity").one()
    assert (log.entity_id, log.status) == (opp.id, "success")


@pytest.mark.parametrize("role", ["viewer_a", "approver_a"])
def test_roles_without_edit_rights_are_forbidden(
    role: str,
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
) -> None:
    opp = _opportunity(db_session, two_orgs.org_a_id, two_orgs.customer_a_id)
    _use(FakeProvider(fixture_text=json.dumps(VALID_BRIEF)))
    response = client.post(
        "/ai/discovery-brief",
        json={"opportunity_id": opp.id, "notes": NOTES},
        headers=_auth(login(getattr(two_orgs, role))),
    )
    assert response.status_code == 403


def test_other_tenant_opportunity_is_not_found(
    client: TestClient, db_session: Session, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    opp = _opportunity(db_session, two_orgs.org_b_id, two_orgs.customer_b_id)
    _use(FakeProvider(fixture_text=json.dumps(VALID_BRIEF)))
    response = client.post(
        "/ai/discovery-brief",
        json={"opportunity_id": opp.id, "notes": NOTES},
        headers=_auth(login(two_orgs.manager_a)),
    )
    assert response.status_code == 404


def test_empty_notes_are_rejected(
    client: TestClient, db_session: Session, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    opp = _opportunity(db_session, two_orgs.org_a_id, two_orgs.customer_a_id)
    response = client.post(
        "/ai/discovery-brief",
        json={"opportunity_id": opp.id, "notes": ""},
        headers=_auth(login(two_orgs.manager_a)),
    )
    assert response.status_code == 422


def test_provider_timeout_is_logged(
    client: TestClient, db_session: Session, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    opp = _opportunity(db_session, two_orgs.org_a_id, two_orgs.customer_a_id)
    _use(FakeProvider(raise_error=ProviderTimeoutError("timeout")))
    response = client.post(
        "/ai/discovery-brief",
        json={"opportunity_id": opp.id, "notes": NOTES},
        headers=_auth(login(two_orgs.manager_a)),
    )
    assert response.status_code == 504
    log = db_session.query(GenerationLog).filter_by(entity_id=opp.id).one()
    assert (log.status, log.error_detail) == ("error", "timeout")


def test_invented_figure_is_rejected_by_guard(
    client: TestClient, db_session: Session, two_orgs: TwoOrgs, login: Callable[[str], str]
) -> None:
    opp = _opportunity(db_session, two_orgs.org_a_id, two_orgs.customer_a_id)
    _use(FakeProvider(fixture_text=json.dumps({**VALID_BRIEF, "summary": "Budget $90,000."})))
    response = client.post(
        "/ai/discovery-brief",
        json={"opportunity_id": opp.id, "notes": NOTES},
        headers=_auth(login(two_orgs.manager_a)),
    )
    assert response.status_code == 502
    log = db_session.query(GenerationLog).filter_by(entity_id=opp.id).one()
    assert log.error_detail is not None
    assert log.error_detail.startswith("Output guard: ")
