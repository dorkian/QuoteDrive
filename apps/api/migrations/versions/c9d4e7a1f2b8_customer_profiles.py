"""Customer profiles: website, HQ, company size, about, industry tags, primary contact

Additive and nullable, so existing rows and clients are unaffected.

Revision ID: c9d4e7a1f2b8
Revises: b7e2c4a9d310
Create Date: 2026-10-08

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c9d4e7a1f2b8"
down_revision: str | None = "b7e2c4a9d310"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_COLUMNS = [
    sa.Column("website", sa.String(length=255), nullable=True),
    sa.Column("hq_city", sa.String(length=128), nullable=True),
    sa.Column("hq_country", sa.String(length=128), nullable=True),
    sa.Column("company_size", sa.String(length=16), nullable=True),
    sa.Column("about", sa.Text(), nullable=True),
    sa.Column("industry_tags", sa.JSON(), nullable=True),
    sa.Column("contact_name", sa.String(length=128), nullable=True),
    sa.Column("contact_title", sa.String(length=128), nullable=True),
    sa.Column("contact_email", sa.String(length=255), nullable=True),
]


def upgrade() -> None:
    for column in _COLUMNS:
        op.add_column("customers", column)


def downgrade() -> None:
    for column in reversed(_COLUMNS):
        op.drop_column("customers", column.name)
