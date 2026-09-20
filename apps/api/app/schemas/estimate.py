from decimal import Decimal

from pydantic import BaseModel, Field


class EstimateLineInput(BaseModel):
    catalogue_item_id: int
    quantity: int = Field(ge=0)
    add_on_item_ids: list[int] = Field(default_factory=list)


class EstimateCalculateRequest(BaseModel):
    lines: list[EstimateLineInput]


class EstimateLineResult(BaseModel):
    catalogue_item_id: int
    name: str
    category: str
    quantity: int
    unit_estimate: Decimal
    line_total: Decimal


class EstimateCalculateResponse(BaseModel):
    lines: list[EstimateLineResult]
    total_estimate: Decimal
    disclaimer: str

