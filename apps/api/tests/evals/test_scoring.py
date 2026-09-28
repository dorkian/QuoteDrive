"""Scoring, report and threshold logic for live evals (QD-418)."""

import json
from pathlib import Path

import pytest

from tests.evals.scoring import Scorecard, build_report, render_markdown, summarize, write_report


def _card(case_id: str, run: int, *results: tuple[str, bool]) -> Scorecard:
    card = Scorecard(suite="narrative", case_id=case_id, run=run)
    for name, ok in results:

        def fn(ok: bool = ok) -> None:
            assert ok, "nope"

        card.check(name, fn)
    return card


def test_a_failed_check_is_recorded_and_later_checks_still_run() -> None:
    card = _card("c", 0, ("valid", False), ("disclaimer", True))

    assert [(c.name, c.passed) for c in card.checks] == [("valid", False), ("disclaimer", True)]
    assert card.checks[0].detail == "nope"
    assert card.score == 0.5
    assert not card.passed


def test_raise_if_failed_names_every_failed_check() -> None:
    card = _card("c", 0, ("valid", False), ("open_question", False))

    with pytest.raises(pytest.fail.Exception, match="valid: nope") as exc_info:
        card.raise_if_failed()
    assert "open_question: nope" in str(exc_info.value)


def test_scenarios_are_scored_across_runs() -> None:
    cards = [
        _card("a", 0, ("valid", True)),
        _card("a", 1, ("valid", False)),
        _card("a", 2, ("valid", True)),
        _card("b", 0, ("valid", True)),
    ]

    by_id = {s.case_id: s for s in summarize(cards)}

    assert (by_id["a"].runs, by_id["a"].passed_runs) == (3, 2)
    assert by_id["a"].failures == ["run 2 valid: nope"]
    assert by_id["b"].pass_rate == 1.0


def test_threshold_passes_at_the_boundary(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EVAL_THRESHOLD", "0.75")
    cards = [_card(c, 0, ("valid", c != "d")) for c in "abcd"]

    report = build_report(cards, "ollama", "qwen")

    assert report.pass_percentage == 0.75
    assert report.approved


def test_below_threshold_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EVAL_THRESHOLD", "0.9")
    cards = [_card(c, 0, ("valid", c != "d")) for c in "abcd"]

    assert not build_report(cards, "ollama", "qwen").approved


def test_any_safety_failure_fails_the_run(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EVAL_THRESHOLD", "0.5")
    cards = [_card(str(i), 0, ("valid", True)) for i in range(9)]
    cards.append(_card("leaky", 0, ("invented_discount", False)))

    report = build_report(cards, "ollama", "qwen")

    assert report.pass_percentage == 0.9
    assert report.safety_failures == ["leaky: run 1 invented_discount: nope"]
    assert not report.approved


def test_an_empty_run_is_never_approved() -> None:
    assert not build_report([], "ollama", "qwen").approved


def test_report_files_hold_scores_not_content(tmp_path: Path) -> None:
    report = build_report(
        [_card("a", 0, ("valid", True), ("open_question", False))], "ollama", "qwen2.5:7b"
    )

    stem = write_report(report, tmp_path)

    data = json.loads(stem.with_name(stem.name + ".json").read_text())
    assert data["provider"] == "ollama"
    assert data["model"] == "qwen2.5:7b"
    assert data["pass_percentage"] == 0.0
    assert data["scenarios"][0]["mean_check_score"] == 0.5
    assert stem.name.endswith("-ollama-qwen2.5-7b")
    markdown = stem.with_name(stem.name + ".md").read_text()
    assert "**FAIL**" in markdown
    assert "| narrative | a | 0/1 | 50% | run 1 open_question: nope |" in markdown
    assert render_markdown(report) == markdown
