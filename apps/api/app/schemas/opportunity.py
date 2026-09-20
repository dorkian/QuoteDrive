from typing import Any

from pydantic import BaseModel


class OpportunityCreate(BaseModel):
    customer_id: int
    title: str


class OpportunityUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    brief_json: dict[str, Any] | None = None


class OpportunityOut(BaseModel):
    id: int
    organization_id: int
    customer_id: int
    owner_id: int
    title: str
    status: str
    brief_json: dict[str, Any] | None = None
