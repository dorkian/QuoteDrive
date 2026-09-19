from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import TenantOwnedMixin


def get_tenant_scoped_or_404[T: TenantOwnedMixin](
    db: Session, model: type[T], id_: int, organization_id: int
) -> T:
    """Fetch a tenant-owned row, scoped to id AND organization_id together.

    A row that exists but belongs to another org 404s exactly like one that
    doesn't exist at all — never reveal cross-tenant existence (security-and-
    tenancy.md Control #4).
    """
    obj = db.execute(
        select(model).where(model.id == id_, model.organization_id == organization_id)
    ).scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return obj


def list_tenant_scoped[T: TenantOwnedMixin](
    db: Session, model: type[T], organization_id: int
) -> Sequence[T]:
    return db.execute(select(model).where(model.organization_id == organization_id)).scalars().all()
