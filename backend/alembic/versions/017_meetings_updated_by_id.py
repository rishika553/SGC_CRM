"""Migration 017 add updated_by_id to meetings

Revision ID: 017_meetings_updated_by_id
Revises: 016_recurring_tasks
Create Date: 2026-08-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '017_meetings_updated_by_id'
down_revision: Union[str, None] = '016_recurring_tasks'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('meetings', sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'updated_by_id')
