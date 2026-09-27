from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import TenantOwnedMixin


def get_tenant_scoped_or_404[T: TenantOwnedMixin](
    db: Session, model: type[T], id_: int, organization_id: int, *, for_update: bool = False
) -> T:
    """Fetch a tenant-owned row, scoped to id AND organization_id together.

    A row that exists but belongs to another org 404s exactly like one that
    doesn't exist at all — never reveal cross-tenant existence (security-and-
    tenancy.md Control #4).

    `for_update` takes a row lock (SELECT ... FOR UPDATE) so a read-check-then-write
    sequence on this row is safe against a concurrent request doing the same —
    pass it whenever the caller is about to branch on the row's current state and
    then mutate it.
    """
    stmt = select(model).where(model.id == id_, model.organization_id == organization_id)
    if for_update:
        stmt = stmt.with_for_update()
    obj = db.execute(stmt).scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return obj
