"""Migration 016 adding recurring task support

Revision ID: 016_recurring_tasks
Revises: 015_meetings_notes
Create Date: 2026-08-22

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '016_recurring_tasks'
down_revision: Union[str, None] = '015_meetings_notes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    recurrence_type_enum = postgresql.ENUM('none', 'daily', 'weekly', 'monthly', 'custom', name='recurrencetypeenum', create_type=False)

    # Create the enum type if it doesn't exist
    op.execute("DO $$ BEGIN CREATE TYPE recurrencetypeenum AS ENUM ('none', 'daily', 'weekly', 'monthly', 'custom'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    op.add_column('tasks', sa.Column('recurrence_type', sa.String(20), nullable=False, server_default='none'))
    op.add_column('tasks', sa.Column('recurrence_interval', sa.Integer(), nullable=True, server_default=None))
    op.add_column('tasks', sa.Column('recurrence_end_date', sa.DateTime(timezone=True), nullable=True, server_default=None))
    op.add_column('tasks', sa.Column('recurrence_parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='SET NULL'), nullable=True, index=True))


def downgrade() -> None:
    op.drop_column('tasks', 'recurrence_parent_id')
    op.drop_column('tasks', 'recurrence_end_date')
    op.drop_column('tasks', 'recurrence_interval')
    op.drop_column('tasks', 'recurrence_type')
    op.execute("DROP TYPE IF EXISTS recurrencetypeenum;")
