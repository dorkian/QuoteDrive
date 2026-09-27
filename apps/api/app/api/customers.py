from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, get_current_membership, require_role
from app.core.database import get_db
from app.models import Customer, Opportunity, Role
from app.repositories.base import get_tenant_scoped_or_404
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate
from app.services.audit import record_audit_event

router = APIRouter(prefix="/customers", tags=["customers"])

_can_edit = require_role(Role.ADMIN, Role.PROPOSAL_MANAGER)


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(
    body: CustomerCreate,
    current: CurrentMembership = Depends(_can_edit),
    db: Session = Depends(get_db),
) -> Customer:
    customer = Customer(
        organization_id=current.organization.id,
        name=body.name,
        industry=body.industry,
    )
    db.add(customer)
    db.flush()
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        actor_name=current.user.display_name,
        entity_type="customer",
        entity_id=customer.id,
        action="create",
        after={
            "name": customer.name,
            "industry": customer.industry,
            "status": customer.status,
        },
    )
    db.commit()
    db.refresh(customer)
    return customer


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = Query(default=None, max_length=200),
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> list[Customer]:
    stmt = select(Customer).where(Customer.organization_id == current.organization.id)
    if q is not None and q.strip():
        # Case-insensitive substring match; escape LIKE wildcards so "%" and "_"
        # in the search box match literally.
        needle = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Customer.name.ilike(f"%{needle}%", escape="\\"))
    return list(db.execute(stmt.order_by(Customer.name, Customer.id)).scalars().all())


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> Customer:
    return get_tenant_scoped_or_404(db, Customer, customer_id, current.organization.id)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    current: CurrentMembership = Depends(_can_edit),
    db: Session = Depends(get_db),
) -> Customer:
    customer = get_tenant_scoped_or_404(db, Customer, customer_id, current.organization.id)
    before = {
        "name": customer.name,
        "industry": customer.industry,
        "status": customer.status,
    }
    if body.name is not None:
        customer.name = body.name
    if body.industry is not None:
        customer.industry = body.industry
    if body.status is not None:
        customer.status = body.status
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        actor_name=current.user.display_name,
        entity_type="customer",
        entity_id=customer.id,
        action="update",
        before=before,
        after={
            "name": customer.name,
            "industry": customer.industry,
            "status": customer.status,
        },
    )
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204)
def delete_customer(
    customer_id: int,
    current: CurrentMembership = Depends(_can_edit),
    db: Session = Depends(get_db),
) -> Response:
    customer = get_tenant_scoped_or_404(db, Customer, customer_id, current.organization.id)
    has_opportunities = (
        db.execute(
            select(Opportunity.id).where(
                Opportunity.customer_id == customer.id,
            )
        ).first()
        is not None
    )
    if has_opportunities:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete customer with existing opportunities",
        )
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        actor_name=current.user.display_name,
        entity_type="customer",
        entity_id=customer.id,
        action="delete",
        before={
            "name": customer.name,
            "industry": customer.industry,
            "status": customer.status,
        },
        after=None,
    )
    db.delete(customer)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
