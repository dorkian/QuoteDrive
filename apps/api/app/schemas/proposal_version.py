from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from app.models.proposal_version import ProposalVersionStatus


class ProposalVersionLineInput(BaseModel):
    catalogue_item_id: int
    quantity: int = Field(ge=0)
    add_on_item_ids: list[int] = Field(default_factory=list)


class ProposalVersionCreate(BaseModel):
    from_version_id: int | None = None


class ProposalVersionUpdate(BaseModel):
    lines: list[ProposalVersionLineInput]


class ProposalVersionOut(BaseModel):
    id: int
    organization_id: int
    opportunity_id: int
    version_number: int
    status: ProposalVersionStatus
    content_json: dict[str, Any]
    total_estimate: Decimal
    created_by: int

