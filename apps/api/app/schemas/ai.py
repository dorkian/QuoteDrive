from pydantic import BaseModel, Field


class ProposalNarrativeRequest(BaseModel):
    proposal_version_id: int
    timeline: str | None = None


class NarrativeOutput(BaseModel):
    executive_summary: str
    recommended_approach: str
    scope: str
    assumptions_exclusions: list[str]
    next_steps: list[str]
    email_draft: str


class ProposalNarrativeResponse(NarrativeOutput):
    disclaimer: str
    provider: str
    model: str


class DiscoveryBriefRequest(BaseModel):
    opportunity_id: int
    notes: str = Field(min_length=1, max_length=8000)


class DiscoveryBriefOutput(BaseModel):
    summary: str
    requirements: list[str]
    open_questions: list[str]
    unknowns: list[str]


class DiscoveryBriefResponse(DiscoveryBriefOutput):
    disclaimer: str
    provider: str
    model: str
