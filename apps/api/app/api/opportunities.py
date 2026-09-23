from typing import Any

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, get_current_membership, require_role
from app.core.database import get_db
from app.models import Customer, Opportunity, Role
from app.repositories.base import get_tenant_scoped_or_404
from app.schemas.opportunity import OpportunityCreate, OpportunityOut, OpportunityUpdate
from app.services.audit import record_audit_event

router = APIRouter(prefix="/opportunities", tags=["opportunities"])

_can_edit = require_role(Role.ADMIN, Role.PROPOSAL_MANAGER)


@router.post("", response_model=OpportunityOut, status_code=201)
def create_opportunity(
    body: OpportunityCreate,
    current: CurrentMembership = Depends(_can_edit),
    db: Session = Depends(get_db),
) -> Opportunity:
    get_tenant_scoped_or_404(db, Customer, body.customer_id, current.organization.id)
    opportunity = Opportunity(
        organization_id=current.organization.id,
        customer_id=body.customer_id,
        owner_id=current.user.id,
        title=body.title,
    )
    db.add(opportunity)
    db.flush()
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        actor_name=current.user.display_name,
        entity_type="opportunity",
        entity_id=opportunity.id,
        action="create",
        after={"title": opportunity.title, "status": opportunity.status},
    )
    db.commit()
    db.refresh(opportunity)
    return opportunity


@router.get("", response_model=list[OpportunityOut])
def list_opportunities(
    customer_id: int | None = Query(default=None),
    owner_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> list[Opportunity]:
    stmt = select(Opportunity).where(Opportunity.organization_id == current.organization.id)
    if customer_id is not None:
        stmt = stmt.where(Opportunity.customer_id == customer_id)
    if owner_id is not None:
        stmt = stmt.where(Opportunity.owner_id == owner_id)
    if status_filter is not None:
        stmt = stmt.where(Opportunity.status == status_filter)
    return list(db.execute(stmt).scalars().all())


@router.get("/{opportunity_id}", response_model=OpportunityOut)
def get_opportunity(
    opportunity_id: int,
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> Opportunity:
    return get_tenant_scoped_or_404(db, Opportunity, opportunity_id, current.organization.id)


@router.patch("/{opportunity_id}", response_model=OpportunityOut)
def update_opportunity(
    opportunity_id: int,
    body: OpportunityUpdate,
    current: CurrentMembership = Depends(_can_edit),
    db: Session = Depends(get_db),
) -> Opportunity:
    opportunity = get_tenant_scoped_or_404(db, Opportunity, opportunity_id, current.organization.id)
    before: dict[str, Any] = {"title": opportunity.title, "status": opportunity.status}
    after: dict[str, Any] = {"title": opportunity.title, "status": opportunity.status}
    if body.title is not None:
        opportunity.title = body.title
        after["title"] = body.title
    if body.status is not None:
        opportunity.status = body.status
        after["status"] = body.status
    if body.brief_json is not None:
        before["brief_json"] = opportunity.brief_json
        opportunity.brief_json = body.brief_json
        after["brief_json"] = body.brief_json
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        actor_name=current.user.display_name,
        entity_type="opportunity",
        entity_id=opportunity.id,
        action="update",
        before=before,
        after=after,
    )
    db.commit()
    db.refresh(opportunity)
    return opportunity


@router.delete("/{opportunity_id}", status_code=204)
def delete_opportunity(
    opportunity_id: int,
    current: CurrentMembership = Depends(_can_edit),
    db: Session = Depends(get_db),
) -> Response:
    opportunity = get_tenant_scoped_or_404(db, Opportunity, opportunity_id, current.organization.id)
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        actor_name=current.user.display_name,
        entity_type="opportunity",
        entity_id=opportunity.id,
        action="delete",
        before={
            "title": opportunity.title,
            "status": opportunity.status,
            "customer_id": opportunity.customer_id,
        },
        after=None,
    )
    db.delete(opportunity)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
