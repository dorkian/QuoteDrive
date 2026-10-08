from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, get_current_membership, require_role
from app.core.database import get_db
from app.models import Customer, Opportunity, Role
from app.repositories.base import get_tenant_scoped_or_404
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate
from app.services.audit import record_audit_event
from app.services.summaries import summarize_customers

router = APIRouter(prefix="/customers", tags=["customers"])

_can_edit = require_role(Role.ADMIN, Role.PROPOSAL_MANAGER)

_PROFILE_FIELDS = (
    "website",
    "hq_city",
    "hq_country",
    "company_size",
    "about",
    "industry_tags",
    "contact_name",
    "contact_title",
    "contact_email",
)


def _profile_values(
    body: CustomerCreate | CustomerUpdate, only_set: bool = False
) -> dict[str, Any]:
    """Profile columns from a request; with `only_set`, just the ones the client sent."""
    names = body.model_fields_set if only_set else set(_PROFILE_FIELDS)
    return {f: getattr(body, f) for f in _PROFILE_FIELDS if f in names}


def _snapshot(customer: Customer) -> dict[str, Any]:
    """What an audit event records about a customer. Unset profile fields are left out,
    so a field that was added or cleared shows up as a difference."""
    return {
        "name": customer.name,
        "industry": customer.industry,
        "status": customer.status,
        **{f: getattr(customer, f) for f in _PROFILE_FIELDS if getattr(customer, f) is not None},
    }


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(
    body: CustomerCreate,
    current: CurrentMembership = Depends(_can_edit),
    db: Session = Depends(get_db),
) -> CustomerOut:
    customer = Customer(
        organization_id=current.organization.id,
        name=body.name,
        industry=body.industry,
        **_profile_values(body),
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
        after=_snapshot(customer),
    )
    db.commit()
    db.refresh(customer)
    return summarize_customers(db, current.organization.id, [customer])[0]


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = Query(default=None, max_length=200),
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> list[CustomerOut]:
    stmt = select(Customer).where(Customer.organization_id == current.organization.id)
    if q is not None and q.strip():
        # Case-insensitive substring match; escape LIKE wildcards so "%" and "_"
        # in the search box match literally.
        needle = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Customer.name.ilike(f"%{needle}%", escape="\\"))
    rows = list(db.execute(stmt.order_by(Customer.name, Customer.id)).scalars().all())
    return summarize_customers(db, current.organization.id, rows)


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> CustomerOut:
    customer = get_tenant_scoped_or_404(db, Customer, customer_id, current.organization.id)
    return summarize_customers(db, current.organization.id, [customer])[0]


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    current: CurrentMembership = Depends(_can_edit),
    db: Session = Depends(get_db),
) -> CustomerOut:
    customer = get_tenant_scoped_or_404(db, Customer, customer_id, current.organization.id)
    before = _snapshot(customer)
    if body.name is not None:
        customer.name = body.name
    if body.industry is not None:
        customer.industry = body.industry
    if body.status is not None:
        customer.status = body.status
    # Profile fields: anything the client sent changes, and null clears it.
    for field, value in _profile_values(body, only_set=True).items():
        setattr(customer, field, value)
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        actor_name=current.user.display_name,
        entity_type="customer",
        entity_id=customer.id,
        action="update",
        before=before,
        after=_snapshot(customer),
    )
    db.commit()
    db.refresh(customer)
    return summarize_customers(db, current.organization.id, [customer])[0]


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
