from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

_Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
_Category = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
_Price = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]


class CatalogueItemOut(BaseModel):
    id: int
    organization_id: int
    type: str
    name: str
    category: str
    base_monthly_estimate: Decimal
    active: bool


class CatalogueItemCreate(BaseModel):
    type: Literal["package", "add_on"]
    name: _Text
    category: _Category
    base_monthly_estimate: _Price
    active: bool = True


class CatalogueItemUpdate(BaseModel):
    # `type` is fixed at creation: saved proposal lines depend on it.
    name: _Text | None = None
    category: _Category | None = None
    base_monthly_estimate: _Price | None = None
    active: bool | None = None
