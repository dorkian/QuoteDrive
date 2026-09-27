from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.proposal_version import ProposalVersionStatus


class ProposalVersionLineInput(BaseModel):
    catalogue_item_id: int
    quantity: int = Field(ge=0)
    add_on_item_ids: list[int] = Field(default_factory=list)
    assumptions: str | None = None


class ProposalVersionCreate(BaseModel):
    from_version_id: int | None = None


class ProposalVersionUpdate(BaseModel):
    lines: list[ProposalVersionLineInput]


class ProposalVersionNarrativeUpdate(BaseModel):
    executive_summary: str
    recommended_approach: str
    scope: str
    assumptions_exclusions: list[str]
    next_steps: list[str]
    email_draft: str
    # Restricted to the GenerationProvider adapters that actually exist
    # (providers/openrouter.py, ollama.py, fake.py's `.name`), so a client
    # can't record a fabricated provider as generation provenance. "manual"
    # marks text a person wrote after AI drafting failed or wasn't used
    # (docs/runbooks/ai-provider-failure.md).
    provider: Literal["openrouter", "ollama", "fake", "manual"]
    model: str


class ProposalVersionOut(BaseModel):
    id: int
    organization_id: int
    opportunity_id: int
    version_number: int
    status: ProposalVersionStatus
    content_json: dict[str, Any]
    narrative_json: dict[str, Any] | None = None
    total_estimate: Decimal
    created_by: int


class ProposalOutcomeCreate(BaseModel):
    outcome: Literal["won", "lost", "expired"]
