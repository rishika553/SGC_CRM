"""Migration 018 add missing BaseCRMModel columns

Revision ID: 018_add_missing_columns
Revises: 017_meetings_updated_by_id
Create Date: 2026-08-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '018_add_missing_columns'
down_revision: Union[str, None] = '017_meetings_updated_by_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_if_missing(table, column, coltype):
    bind = op.get_bind()
    res = bind.execute(sa.text(
        f"SELECT column_name FROM information_schema.columns "
        f"WHERE table_name = '{table}' AND column_name = '{column}'"
    ))
    if res.fetchone() is None:
        op.add_column(table, sa.Column(column, coltype, nullable=True))


def upgrade() -> None:
    _add_if_missing('notes', 'updated_by_id', postgresql.UUID(as_uuid=True))


def downgrade() -> None:
    op.drop_column('notes', 'updated_by_id')
