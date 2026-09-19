from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, get_current_membership, require_role
from app.core.database import get_db
from app.models import Opportunity, Role
from app.repositories.base import get_tenant_scoped_or_404, list_tenant_scoped
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
    opportunity = Opportunity(
        organization_id=current.organization.id, owner_id=current.user.id, title=body.title
    )
    db.add(opportunity)
    db.flush()
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
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
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> list[Opportunity]:
    return list(list_tenant_scoped(db, Opportunity, current.organization.id))


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
    before = {"title": opportunity.title, "status": opportunity.status}
    if body.title is not None:
        opportunity.title = body.title
    if body.status is not None:
        opportunity.status = body.status
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        entity_type="opportunity",
        entity_id=opportunity.id,
        action="update",
        before=before,
        after={"title": opportunity.title, "status": opportunity.status},
    )
    db.commit()
    db.refresh(opportunity)
    return opportunity
