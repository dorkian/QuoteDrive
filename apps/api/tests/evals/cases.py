"""Loads docs/evaluations/*.json into parametrized pytest cases (QD-403)."""

import json
from pathlib import Path
from typing import Any

import pytest

EVALUATIONS_DIR = Path(__file__).resolve().parents[4] / "docs" / "evaluations"
NARRATIVE_FILE = "proposal-narrative-cases.json"


def load_cases(file_name: str) -> list[Any]:
    """One pytest.param per case, id'd by the case id.

    A `skip` reason on the file or on a case keeps it visible as a skipped
    test instead of silently dropping it.
    """
    data = json.loads((EVALUATIONS_DIR / file_name).read_text(encoding="utf-8"))
    file_skip = data.get("skip")
    params = []
    for case in data["cases"]:
        reason = case.get("skip") or file_skip
        marks = [pytest.mark.skip(reason=reason)] if reason else []
        params.append(pytest.param(case, id=case["id"], marks=marks))
    return params


def all_fixture_files() -> list[str]:
    return sorted(p.name for p in EVALUATIONS_DIR.glob("*.json"))
