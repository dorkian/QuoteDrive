"""customers and opportunity links

Revision ID: f4a81c2d9e03
Revises: e3eef21d1e44
Create Date: 2026-09-19

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f4a81c2d9e03"
down_revision: str | None = "e3eef21d1e44"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("industry", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.add_column(
        "opportunities",
        sa.Column(
            "customer_id",
            sa.Integer(),
            sa.ForeignKey("customers.id"),
            nullable=False,
        ),
    )
    op.add_column("opportunities", sa.Column("brief_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("opportunities", "brief_json")
    op.drop_column("opportunities", "customer_id")
    op.drop_table("customers")
