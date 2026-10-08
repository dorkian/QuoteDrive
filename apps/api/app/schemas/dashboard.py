from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

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


class StageStat(BaseModel):
    status: str
    count: int
    value: Decimal


class WeeklyPoint(BaseModel):
    week_start: date
    opportunities_created: int
    versions_created: int
    value_created: Decimal
    approvals_decided: int
    median_approval_hours: float | None


class PackageStat(BaseModel):
    name: str
    category: str
    quantity: int
    value: Decimal


class AiStat(BaseModel):
    provider: str
    model: str
    total: int
    succeeded: int
    failed: int
    fallbacks: int
    median_latency_ms: int | None


class AnalyticsKpis(BaseModel):
    open_pipeline_value: Decimal
    open_opportunities: int
    win_rate: float | None
    won: int
    lost: int
    awaiting_approval: int
    median_approval_hours: float | None
    ai_success_rate: float | None
    ai_generations: int


class DashboardAnalytics(BaseModel):
    range: Literal["4w", "12w", "all"]
    kpis: AnalyticsKpis
    stages: list[StageStat]
    weekly: list[WeeklyPoint]
    packages: list[PackageStat]
    ai: list[AiStat]
