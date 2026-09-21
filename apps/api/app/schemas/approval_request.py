from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.approval_request import ApprovalRequestStatus

_COMMENT_MAX_LENGTH = 4096  # matches approval_comments.body's String(4096) column


class ApprovalRequestCreate(BaseModel):
    assigned_to: int


class ApprovalRequestOut(BaseModel):
    id: int
    organization_id: int
    proposal_version_id: int
    requested_by: int
    assigned_to: int
    status: ApprovalRequestStatus
    decision_at: datetime | None
    created_at: datetime


class ApproveRequest(BaseModel):
    comment: str | None = Field(default=None, max_length=_COMMENT_MAX_LENGTH)

    @field_validator("comment")
    @classmethod
    def _strip_comment(cls, v: str | None) -> str | None:
        if v is None:
            return v
        stripped = v.strip()
        return stripped or None


class RequestChangesRequest(BaseModel):
    comment: str = Field(min_length=1, max_length=_COMMENT_MAX_LENGTH)

    @field_validator("comment")
    @classmethod
    def _strip_comment(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("comment must not be blank")
        return stripped
