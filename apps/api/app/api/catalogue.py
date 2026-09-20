from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, get_current_membership
from app.core.database import get_db
from app.models.catalogue_item import CatalogueItem
from app.schemas.catalogue_item import CatalogueItemOut

router = APIRouter(prefix="/catalogue", tags=["catalogue"])


@router.get("/items", response_model=list[CatalogueItemOut])
def list_catalogue_items(
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> list[CatalogueItem]:
    stmt = select(CatalogueItem).where(
        CatalogueItem.organization_id == current.organization.id,
        CatalogueItem.active.is_(True),
    )
    return list(db.execute(stmt).scalars().all())
