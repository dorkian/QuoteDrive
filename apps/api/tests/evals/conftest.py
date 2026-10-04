"""Live-run report and release threshold (QD-418).

Only live runs (EVAL_PROVIDER set) collect scorecards; CI runs leave
LIVE_RESULTS empty, so these hooks do nothing there.
"""

import os

import pytest

from app.core.config import settings
from tests.evals import scoring


def _live_model(provider: str) -> str:
    return {"openrouter": settings.OPENROUTER_MODEL, "ollama": settings.OLLAMA_MODEL}.get(
        provider, provider
    )


def _report() -> scoring.Report | None:
    if not scoring.LIVE_RESULTS:
        return None
    provider = os.environ.get("EVAL_PROVIDER", "unknown")
    return scoring.build_report(scoring.LIVE_RESULTS, provider, _live_model(provider))


_REPORT: dict[str, scoring.Report] = {}


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    report = _report()
    if report is None:
        return
    _REPORT["latest"] = report
    if os.environ.get("EVAL_WRITE_REPORT", "1") != "0":
        scoring.write_report(report)
    if not report.approved and session.exitstatus == 0:
        session.exitstatus = pytest.ExitCode.TESTS_FAILED


def pytest_terminal_summary(terminalreporter: pytest.TerminalReporter) -> None:
    report = _REPORT.get("latest")
    if report is None:
        return
    terminalreporter.section("AI eval report (QD-418)")
    for line in scoring.render_markdown(report).splitlines():
        terminalreporter.write_line(line)
    if not report.approved:
        reasons = []
        if report.pass_percentage < report.threshold:
            reasons.append(
                f"pass percentage {report.pass_percentage:.0%} is below {report.threshold:.0%}"
            )
        if report.safety_failures:
            reasons.append(f"{len(report.safety_failures)} safety failure(s)")
        terminalreporter.write_line("FAILED: " + "; ".join(reasons), red=True, bold=True)
