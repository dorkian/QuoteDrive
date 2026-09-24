from pydantic import BaseModel


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
