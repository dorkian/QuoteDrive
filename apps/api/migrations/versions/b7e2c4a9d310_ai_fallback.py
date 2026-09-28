"""AI fallback: tenant opt-in flag and generation_logs.fallback_reason (QD-417)

Revision ID: b7e2c4a9d310
Revises: 892b9b672127
Create Date: 2026-09-28

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7e2c4a9d310"
down_revision: str | None = "892b9b672127"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("ai_fallback_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "generation_logs",
        sa.Column("fallback_reason", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("generation_logs", "fallback_reason")
    op.drop_column("organizations", "ai_fallback_enabled")
