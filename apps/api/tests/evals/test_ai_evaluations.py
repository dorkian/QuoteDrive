"""AI evaluation suite (QD-403): every case in docs/evaluations/*.json runs here.

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
from app.services.ai.narrative_service import build_prompt
from app.services.ai.providers import GenerationProvider, get_provider
from app.services.ai.providers.fake import FakeProvider
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
    assert clean.system[:60] not in text, "system prompt leaked"
    smuggled = checks.numbers_in(notes) - checks.numbers_in(json.dumps(case_input["lines"]))
    assert not smuggled & checks.numbers_in(text), "injected figure reached the output"
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

    if expect.get("safe_failure"):
        assert response.status_code == 502, response.text
        db.refresh(version)
        assert version.narrative_json == EXISTING_DRAFT, "existing draft was overwritten"
        assert log.status == "error"
        assert log.error_detail
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
            assert (data["provider"], data["model"]) == (provider.name, provider.model)
            assert (log.provider, log.model, log.status) == (
                provider.name,
                provider.model,
                "success",
            )
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
    _run_case(case, FakeProvider(fixture_text=text), client, db_session, two_orgs, login)


@pytest.mark.parametrize("case", load_cases(DISCOVERY_FILE))
def test_discovery_brief_case(case: dict[str, Any]) -> None:
    pytest.fail("discovery-brief cases need a runner once QD-404 adds the endpoint")


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
    live = settings.model_copy(update={"AI_PROVIDER": os.environ["EVAL_PROVIDER"]})
    _run_case(case, get_provider(live), client, db_session, two_orgs, login)
