from decimal import Decimal

from pydantic import BaseModel


class CatalogueItemOut(BaseModel):
    id: int
    organization_id: int
    type: str
    name: str
    category: str
    base_monthly_estimate: Decimal
    active: bool
