from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, literal, select, tuple_
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, get_current_membership
from app.core.database import get_db
from app.models import AuditEvent, Opportunity, ProposalVersion
from app.schemas.dashboard import AuditEventOut, DashboardSummary

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    rows = db.execute(
        select(Opportunity.status, func.count())
        .where(Opportunity.organization_id == current.organization.id)
        .group_by(Opportunity.status)
    ).all()
    version_rows = db.execute(
        select(ProposalVersion.status, func.count())
        .where(ProposalVersion.organization_id == current.organization.id)
        .group_by(ProposalVersion.status)
    ).all()
    return DashboardSummary(
        opportunities_by_status={status: count for status, count in rows},
        proposal_versions_by_status={status.value: count for status, count in version_rows},
    )


@router.get("/audit-events", response_model=list[AuditEventOut])
def list_audit_events(
    limit: int = Query(default=20, ge=1, le=100),
    before_id: int | None = Query(default=None),
    entity_type: str | None = None,
    entity_id: int | None = None,
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> list[AuditEventOut]:
    stmt = select(AuditEvent).where(AuditEvent.organization_id == current.organization.id)
    if entity_type is not None:
        stmt = stmt.where(AuditEvent.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(AuditEvent.entity_id == entity_id)
    if before_id is not None:
        # Filter on the same (created_at, id) composite the results are ordered
        # by, not id alone — created_at is set app-side (not DB-sequenced), so
        # id order and created_at order aren't guaranteed to agree; a plain
        # `id < before_id` filter could then skip or repeat an event relative
        # to where it was actually listed on the previous page.
        anchor_created_at = (
            select(AuditEvent.created_at)
            .where(
                AuditEvent.id == before_id,
                AuditEvent.organization_id == current.organization.id,
            )
            .scalar_subquery()
        )
        stmt = stmt.where(
            tuple_(AuditEvent.created_at, AuditEvent.id)
            < tuple_(anchor_created_at, literal(before_id))
        )
    # id is a tiebreaker for events sharing a created_at tick — created_at alone
    # isn't a stable sort key, and callers (this card's tests, QD-304's timeline
    # UI) depend on a deterministic most-recent-first order.
    stmt = stmt.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).limit(limit)
    events = db.execute(stmt).scalars().all()
    return [
        AuditEventOut(
            id=event.id,
            actor_id=event.actor_id,
            actor_name=event.actor_name,
            entity_type=event.entity_type,
            entity_id=event.entity_id,
            action=event.action,
            before_json=event.before_json,
            after_json=event.after_json,
            created_at=event.created_at,
        )
        for event in events
    ]
