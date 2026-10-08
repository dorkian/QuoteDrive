"""The demo-history seed builds a coherent, idempotent, chart-ready dataset."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Opportunity, Organization
from app.services.analytics import build_analytics
from scripts import seed_demo_history


def test_seed_is_idempotent_and_feeds_the_analytics(db_session: Session) -> None:
    seed_demo_history.seed(db_session)
    seed_demo_history.seed(db_session)  # second run must change nothing

    org = db_session.execute(select(Organization)).scalar_one()
    seeded = db_session.execute(
        select(func.count()).select_from(Opportunity).where(Opportunity.organization_id == org.id)
    ).scalar_one()
    assert seeded == 3 + len(seed_demo_history.CASES)  # the 3 base demo opportunities + the stories

    data = build_analytics(db_session, org.id, "all")
    assert (data.kpis.won, data.kpis.lost) == (5, 3)
    assert data.kpis.win_rate == 62.5
    assert data.kpis.awaiting_approval == 1
    assert data.kpis.median_approval_hours is not None
    assert data.kpis.open_pipeline_value > 0
    assert {a.provider for a in data.ai} == {"ollama", "openrouter"}
    assert sum(1 for p in data.weekly if p.opportunities_created) >= 8  # spread over many weeks
    assert {s.status for s in data.stages if s.count} >= {"won", "lost", "expired", "shared"}
    assert len(data.packages) == 3
