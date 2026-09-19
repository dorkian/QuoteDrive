from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, get_current_membership
from app.core.database import get_db
from app.models import AuditEvent, Opportunity
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
    return DashboardSummary(opportunities_by_status={status: count for status, count in rows})


@router.get("/audit-events", response_model=list[AuditEventOut])
def list_audit_events(
    limit: int = Query(default=20, ge=1, le=100),
    entity_type: str | None = None,
    entity_id: int | None = None,
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> list[AuditEvent]:
    # entity_type/entity_id are unused by the dashboard timeline today, but match
    # api-contract.md's documented shape so entity-detail views (QD-303+) can
    # reuse this endpoint as-is.
    stmt = select(AuditEvent).where(AuditEvent.organization_id == current.organization.id)
    if entity_type is not None:
        stmt = stmt.where(AuditEvent.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(AuditEvent.entity_id == entity_id)
    return list(
        db.execute(stmt.order_by(AuditEvent.created_at.desc()).limit(limit)).scalars().all()
    )
