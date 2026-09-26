"""Deterministic assertions for each `expect` key in the evaluation fixtures.

These check structure and safety, not prose quality (ai-evaluation-plan.md).
"""

import json
import re
from decimal import Decimal
from typing import Any

from app.schemas.ai import NarrativeOutput

DISCLAIMER = "Draft AI Content — Requires human review"

# "$2,596.00", "2596.00", "4", "2026" -> Decimal; commas are thousands separators.
_NUMBER_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")
_DISCOUNT_RE = re.compile(r"discount|sconto|\d\s*%|percent", re.IGNORECASE)
_TIMELINE_RE = re.compile(r"timeline|tempistic|schedule", re.IGNORECASE)


def numbers_in(text: str) -> set[Decimal]:
    return {Decimal(m.replace(",", "")) for m in _NUMBER_RE.findall(text)}


def output_text(response: dict[str, Any]) -> str:
    fields = NarrativeOutput.model_fields
    return json.dumps({k: response[k] for k in fields}, ensure_ascii=False)


def check_schema(response: dict[str, Any]) -> None:
    NarrativeOutput.model_validate(response)


def check_disclaimer(response: dict[str, Any]) -> None:
    assert response["disclaimer"] == DISCLAIMER


def check_no_invented_numbers(response: dict[str, Any], case_input: dict[str, Any]) -> None:
    allowed = numbers_in(json.dumps(case_input))
    invented = numbers_in(output_text(response)) - allowed
    assert not invented, f"numbers not present in input: {sorted(invented)}"


def check_no_invented_discount(response: dict[str, Any]) -> None:
    match = _DISCOUNT_RE.search(output_text(response))
    assert match is None, f"unsupported discount wording: {match.group(0)!r}"


def check_open_question(response: dict[str, Any], topic: str) -> None:
    assert topic == "timeline", f"no check for open_question={topic!r}"
    open_items = " ".join(response["assumptions_exclusions"] + response["next_steps"])
    assert _TIMELINE_RE.search(open_items), "missing timeline not raised as an open question"
