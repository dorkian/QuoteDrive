"""Add narrative_json to proposal_versions

Revision ID: 892b9b672127
Revises: a4dbbe5e34c5
Create Date: 2026-09-24 11:34:35.424781

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "892b9b672127"
down_revision: str | Sequence[str] | None = "a4dbbe5e34c5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("proposal_versions", sa.Column("narrative_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("proposal_versions", "narrative_json")
