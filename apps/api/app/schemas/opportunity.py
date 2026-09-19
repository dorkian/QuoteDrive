from pydantic import BaseModel


class OpportunityCreate(BaseModel):
    title: str


class OpportunityUpdate(BaseModel):
    title: str | None = None
    status: str | None = None


class OpportunityOut(BaseModel):
    id: int
    organization_id: int
    owner_id: int
    title: str
    status: str
