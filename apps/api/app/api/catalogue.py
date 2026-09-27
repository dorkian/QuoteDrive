from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, get_current_membership, require_role
from app.core.database import get_db
from app.models import Role
from app.models.catalogue_item import CatalogueItem
from app.repositories.base import get_tenant_scoped_or_404
from app.schemas.catalogue_item import (
    CatalogueItemCreate,
    CatalogueItemOut,
    CatalogueItemUpdate,
)
from app.services.audit import record_audit_event

router = APIRouter(prefix="/catalogue", tags=["catalogue"])

_admin_only = require_role(Role.ADMIN)


def _snapshot(item: CatalogueItem) -> dict[str, Any]:
    return {
        "type": item.type,
        "name": item.name,
        "category": item.category,
        "base_monthly_estimate": str(item.base_monthly_estimate),
        "active": item.active,
    }


@router.get("/items", response_model=list[CatalogueItemOut])
def list_catalogue_items(
    include_inactive: bool = Query(default=False),
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> list[CatalogueItem]:
    stmt = select(CatalogueItem).where(CatalogueItem.organization_id == current.organization.id)
    if include_inactive:
        # Inactive items are catalogue administration, not something to quote.
        if current.role != Role.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role for this action",
            )
    else:
        stmt = stmt.where(CatalogueItem.active.is_(True))
    stmt = stmt.order_by(CatalogueItem.type.desc(), CatalogueItem.name, CatalogueItem.id)
    return list(db.execute(stmt).scalars().all())


@router.post("/items", response_model=CatalogueItemOut, status_code=201)
def create_catalogue_item(
    body: CatalogueItemCreate,
    current: CurrentMembership = Depends(_admin_only),
    db: Session = Depends(get_db),
) -> CatalogueItem:
    item = CatalogueItem(
        organization_id=current.organization.id,
        type=body.type,
        name=body.name,
        category=body.category,
        base_monthly_estimate=body.base_monthly_estimate,
        active=body.active,
    )
    db.add(item)
    db.flush()
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        actor_name=current.user.display_name,
        entity_type="catalogue_item",
        entity_id=item.id,
        action="create",
        after=_snapshot(item),
    )
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=CatalogueItemOut)
def update_catalogue_item(
    item_id: int,
    body: CatalogueItemUpdate,
    current: CurrentMembership = Depends(_admin_only),
    db: Session = Depends(get_db),
) -> CatalogueItem:
    item = get_tenant_scoped_or_404(db, CatalogueItem, item_id, current.organization.id)
    before = _snapshot(item)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    after = _snapshot(item)
    if after != before:
        record_audit_event(
            db,
            organization_id=current.organization.id,
            actor_id=current.user.id,
            actor_name=current.user.display_name,
            entity_type="catalogue_item",
            entity_id=item.id,
            action="update",
            before=before,
            after=after,
        )
    db.commit()
    db.refresh(item)
    return item
