from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class OpportunityCreate(BaseModel):
    customer_id: int
    title: str


class OpportunityUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    brief_json: dict[str, Any] | None = None


class LatestVersionOut(BaseModel):
    id: int
    version_number: int
    status: str
    total_estimate: Decimal


class OpportunityOut(BaseModel):
    id: int
    organization_id: int
    customer_id: int
    owner_id: int
    title: str
    status: str
    brief_json: dict[str, Any] | None = None
    # Summary fields for lists and panels. Always present on list/get/create/update;
    # the defaults only matter for callers that build the model by hand.
    created_at: datetime | None = None
    owner_name: str | None = None
    version_count: int = 0
    latest_version: LatestVersionOut | None = None
    last_activity_at: datetime | None = None
