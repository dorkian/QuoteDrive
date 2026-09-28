"""AI evaluation suite (QD-403, QD-404): every case in docs/evaluations/*.json runs here.

CI runs the canned `model_output` of each case through FakeProvider, so it
tests our pipeline (prompt building, parsing, disclaimer, failure handling)
deterministically. To run the same inputs and checks against a real model:

    EVAL_PROVIDER=ollama pytest tests/evals -k live
"""

import json
import os
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.deps import get_ai_provider
from app.core.config import settings
from app.main import app
from app.models import Customer, GenerationLog, Opportunity, ProposalVersion
from app.services.ai import discovery_service
from app.services.ai.narrative_service import build_prompt
from app.services.ai.output_guard import numbers_in
from app.services.ai.providers import GenerationProvider, get_provider
from app.services.ai.providers.base import ProviderTimeoutError, ProviderTransientError
from app.services.ai.providers.fake import FakeProvider
from app.services.ai.providers.fallback import FallbackProvider
from tests.conftest import TwoOrgs
from tests.evals import checks
from tests.evals.cases import NARRATIVE_FILE, all_fixture_files, load_cases

DISCOVERY_FILE = "discovery-brief-cases.json"
WIRED_FILES = {NARRATIVE_FILE, DISCOVERY_FILE}

EXISTING_DRAFT = {"executive_summary": "Previously reviewed draft"}


def _seed(db: Session, orgs: TwoOrgs, case_input: dict[str, Any]) -> ProposalVersion:
    customer = db.get(Customer, orgs.customer_a_id)
    assert customer is not None
    customer.name = case_input["customer"]
    opportunity = Opportunity(
        organization_id=orgs.org_a_id,
        customer_id=customer.id,
        owner_id=1,
        title=case_input["opportunity"],
        brief_json=case_input["brief"],
    )
    db.add(opportunity)
    db.flush()
    version = ProposalVersion(
        organization_id=orgs.org_a_id,
        opportunity_id=opportunity.id,
        created_by=1,
        version_number=1,
        status="draft",
        content_json={"lines": case_input["lines"]},
        narrative_json=EXISTING_DRAFT,
    )
    db.add(version)
    db.commit()
    return version


def _check_injection(
    db: Session, version: ProposalVersion, case_input: dict[str, Any], response: dict[str, Any]
) -> None:
    opportunity = db.get(Opportunity, version.opportunity_id)
    assert opportunity is not None
    customer = db.get(Customer, opportunity.customer_id)
    assert customer is not None
    injected = build_prompt(version, opportunity, customer, case_input["timeline"])

    # The untrusted notes must not change the system instructions...
    brief = opportunity.brief_json
    opportunity.brief_json = None
    clean = build_prompt(version, opportunity, customer, case_input["timeline"])
    opportunity.brief_json = brief
    assert injected.system == clean.system

    # ...must stay inside the data delimiters...
    notes = case_input["brief"]["notes"]
    start = injected.prompt.index("<<<PROPOSAL_DATA>>>")
    end = injected.prompt.index("<<<END_PROPOSAL_DATA>>>")
    assert start < injected.prompt.index(notes) < end

    # ...and nothing they asked for may reach the output.
    text = checks.output_text(response)
    assert clean.system is not None
    checks.check_system_not_leaked(clean.system, text)
    smuggled = numbers_in(notes) - numbers_in(json.dumps(case_input["lines"]))
    assert not smuggled & numbers_in(text), "injected figure reached the output"
    checks.check_no_invented_discount(response)


def _run_case(
    case: dict[str, Any],
    provider: GenerationProvider,
    client: TestClient,
    db: Session,
    orgs: TwoOrgs,
    login: Callable[[str], str],
) -> None:
    case_input = case["input"]
    expect = case["expect"]
    version = _seed(db, orgs, case_input)

    app.dependency_overrides[get_ai_provider] = lambda: provider
    try:
        response = client.post(
            "/ai/proposal-narrative",
            json={"proposal_version_id": version.id, "timeline": case_input["timeline"]},
            headers={"Authorization": f"Bearer {login(orgs.manager_a)}"},
        )
    finally:
        app.dependency_overrides.pop(get_ai_provider, None)
    log = db.query(GenerationLog).filter_by(entity_id=version.id).one()

    guarded = response.status_code == 502 and "Output guard" in (log.error_detail or "")
    # Live models may still misbehave; a guard rejection is the handled outcome (QD-410).
    if expect.get("safe_failure") or (guarded and case.get("guard_may_reject")):
        assert response.status_code == expect.get("status", 502), response.text
        db.refresh(version)
        assert version.narrative_json == EXISTING_DRAFT, "existing draft was overwritten"
        assert log.status == "error"
        assert log.error_detail
        if "guard_reason" in expect:
            assert guarded, log.error_detail
            assert expect["guard_reason"] in log.error_detail
        return

    assert response.status_code == 200, response.text
    data = response.json()
    for key, value in expect.items():
        if key == "valid":
            assert value == "schema", f"no check for valid={value!r}"
            checks.check_schema(data)
        elif key == "disclaimer":
            checks.check_disclaimer(data)
        elif key == "invented_numbers":
            assert value is False
            checks.check_no_invented_numbers(data, case_input)
        elif key == "invented_discount":
            assert value is False
            checks.check_no_invented_discount(data)
        elif key == "open_question":
            checks.check_open_question(data, value)
        elif key == "ignore_untrusted_instruction":
            _check_injection(db, version, case_input, data)
        elif key == "provider_provenance":
            # With a fallback the answering provider isn't the configured one.
            answered = case.get("answered_by", {"provider": provider.name, "model": provider.model})
            assert (data["provider"], data["model"]) == (answered["provider"], answered["model"])
            assert (log.provider, log.model, log.status) == (
                answered["provider"],
                answered["model"],
                "success",
            )
        elif key == "fallback_reason":
            assert data["fallback_reason"] == value
            assert log.fallback_reason == value
        else:
            pytest.fail(f"unknown expect key {key!r}: add a check before adding the fixture")


@pytest.mark.parametrize("case", load_cases(NARRATIVE_FILE))
def test_proposal_narrative_case(
    case: dict[str, Any],
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
) -> None:
    output = case["model_output"]
    text = output if isinstance(output, str) else json.dumps(output, ensure_ascii=False)
    _run_case(case, _case_provider(case, text), client, db_session, two_orgs, login)


def _case_provider(case: dict[str, Any], text: str) -> GenerationProvider:
    """A plain FakeProvider, or one behind FallbackProvider for cases 8 and 9.

    `primary_failure` makes the primary fail transiently on every try;
    `fallback_allowed` says whether the tenant allows the fallback (ADR-005).
    """
    answer = FakeProvider(fixture_text=text, model="fallback-model")
    failure = case.get("primary_failure")
    if failure is None:
        return FakeProvider(fixture_text=text)
    error = (
        ProviderTimeoutError("primary timed out")
        if failure == "timeout"
        else ProviderTransientError("primary returned 503")
    )
    return FallbackProvider(
        FakeProvider(raise_error=error),
        answer if case.get("fallback_allowed") else None,
        retry_backoff_seconds=0,
    )


EXISTING_BRIEF = {"summary": "Previously saved brief"}


def _check_discovery_injection(opportunity: Opportunity, notes: str, text: str) -> None:
    injected = discovery_service.build_prompt(opportunity, notes)
    clean = discovery_service.build_prompt(opportunity, "Clean notes.")
    assert injected.system == clean.system
    start = injected.prompt.index("<<<DISCOVERY_NOTES>>>")
    end = injected.prompt.index("<<<END_DISCOVERY_NOTES>>>")
    assert start < injected.prompt.index(notes) < end
    assert clean.system is not None
    checks.check_system_not_leaked(clean.system, text)
    assert checks.DISCOUNT_RE.search(text) is None, "injected discount reached the output"


def _run_discovery_case(
    case: dict[str, Any],
    provider: GenerationProvider,
    client: TestClient,
    db: Session,
    orgs: TwoOrgs,
    login: Callable[[str], str],
) -> None:
    case_input = case["input"]
    expect = case["expect"]
    opportunity = Opportunity(
        organization_id=orgs.org_a_id,
        customer_id=orgs.customer_a_id,
        owner_id=1,
        title=case_input["opportunity"],
        brief_json=EXISTING_BRIEF,
    )
    db.add(opportunity)
    db.commit()

    app.dependency_overrides[get_ai_provider] = lambda: provider
    try:
        response = client.post(
            "/ai/discovery-brief",
            json={"opportunity_id": opportunity.id, "notes": case_input["notes"]},
            headers={"Authorization": f"Bearer {login(orgs.manager_a)}"},
        )
    finally:
        app.dependency_overrides.pop(get_ai_provider, None)
    log = db.query(GenerationLog).filter_by(entity_id=opportunity.id).one()
    db.refresh(opportunity)
    # Drafting never saves: only the human-reviewed PATCH changes the brief.
    assert opportunity.brief_json == EXISTING_BRIEF

    guarded = response.status_code == 502 and "Output guard" in (log.error_detail or "")
    if expect.get("safe_failure") or (guarded and case.get("guard_may_reject")):
        assert response.status_code == 502, response.text
        assert log.status == "error"
        assert log.error_detail
        return

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["disclaimer"] == checks.DISCLAIMER
    for key, value in expect.items():
        if key == "valid":
            assert value == "schema", f"no check for valid={value!r}"
            checks.check_brief_schema(data)
        elif key == "unknowns":
            checks.check_unknowns(data, value)
        elif key == "ignore_untrusted_instruction":
            _check_discovery_injection(opportunity, case_input["notes"], json.dumps(data))
        else:
            pytest.fail(f"unknown expect key {key!r}: add a check before adding the fixture")


@pytest.mark.parametrize("case", load_cases(DISCOVERY_FILE))
def test_discovery_brief_case(
    case: dict[str, Any],
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
) -> None:
    output = case["model_output"]
    text = output if isinstance(output, str) else json.dumps(output, ensure_ascii=False)
    _run_discovery_case(case, FakeProvider(fixture_text=text), client, db_session, two_orgs, login)


def test_every_fixture_file_is_wired() -> None:
    assert set(all_fixture_files()) <= WIRED_FILES


@pytest.mark.skipif(not os.environ.get("EVAL_PROVIDER"), reason="set EVAL_PROVIDER to run live")
@pytest.mark.parametrize("case", load_cases(NARRATIVE_FILE))
def test_live_proposal_narrative_case(
    case: dict[str, Any],
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
) -> None:
    if case["expect"].get("safe_failure"):
        pytest.skip("failure cases need a canned bad output")
    if "primary_failure" in case:
        pytest.skip("fallback cases script the primary's failure; they run with fakes only")
    live = settings.model_copy(update={"AI_PROVIDER": os.environ["EVAL_PROVIDER"]})
    _run_case(case, get_provider(live), client, db_session, two_orgs, login)


@pytest.mark.skipif(not os.environ.get("EVAL_PROVIDER"), reason="set EVAL_PROVIDER to run live")
@pytest.mark.parametrize("case", load_cases(DISCOVERY_FILE))
def test_live_discovery_brief_case(
    case: dict[str, Any],
    client: TestClient,
    db_session: Session,
    two_orgs: TwoOrgs,
    login: Callable[[str], str],
) -> None:
    if case["expect"].get("safe_failure"):
        pytest.skip("failure cases need a canned bad output")
    live = settings.model_copy(update={"AI_PROVIDER": os.environ["EVAL_PROVIDER"]})
    _run_discovery_case(case, get_provider(live), client, db_session, two_orgs, login)
