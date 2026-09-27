from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    opportunities_by_status: dict[str, int]
    proposal_versions_by_status: dict[str, int]


class AuditEventOut(BaseModel):
    id: int
    actor_id: int
    actor_name: str
    entity_type: str
    entity_id: int
    action: str
    before_json: dict[str, Any] | None
    after_json: dict[str, Any] | None
    created_at: datetime
