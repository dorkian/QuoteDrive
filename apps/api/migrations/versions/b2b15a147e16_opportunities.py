"""opportunities: minimal tenant-scoped resource for QD-102's RBAC/tenant-scoping proof

Revision ID: b2b15a147e16
Revises: 956ec8980cae
Create Date: 2026-09-19

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b2b15a147e16"
down_revision: str | None = "956ec8980cae"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "opportunities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("opportunities")
