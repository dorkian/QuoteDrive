from decimal import Decimal

from pydantic import BaseModel


class CustomerCreate(BaseModel):
    name: str
    industry: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    industry: str | None = None
    status: str | None = None


class CustomerOut(BaseModel):
    id: int
    organization_id: int
    name: str
    industry: str | None = None
    status: str
    # Summary fields; see services/summaries.py.
    opportunity_count: int = 0
    open_opportunities: int = 0
    open_pipeline_value: Decimal = Decimal(0)
