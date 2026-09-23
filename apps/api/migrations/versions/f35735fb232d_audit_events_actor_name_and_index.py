"""audit_events: snapshot actor_name at write time, index for timeline pagination

Revision ID: f35735fb232d
Revises: d3f6a9c1b5e7
Create Date: 2026-09-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f35735fb232d"
down_revision: str | None = "d3f6a9c1b5e7"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("audit_events", sa.Column("actor_name", sa.String(length=255), nullable=True))
    op.execute(
        "UPDATE audit_events SET actor_name = users.display_name "
        "FROM users WHERE users.id = audit_events.actor_id"
    )
    op.alter_column("audit_events", "actor_name", nullable=False)
    op.create_index(
        "ix_audit_events_org_created_id",
        "audit_events",
        ["organization_id", "created_at", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_events_org_created_id", table_name="audit_events")
    op.drop_column("audit_events", "actor_name")
