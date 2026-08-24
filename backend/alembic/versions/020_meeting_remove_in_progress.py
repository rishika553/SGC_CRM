"""Remove in_progress and completed from meetings status.

Revision ID: 020
Revises: 019_multi_rm_assignments
Create Date: 2026-08-23
"""
from alembic import op
import sqlalchemy as sa

revision = "020_meeting_remove_in_progress"
down_revision = "019_multi_rm_assignments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Migrate existing 'in_progress' and 'completed' meetings to 'scheduled'
    op.execute(
        "UPDATE meetings SET status = 'scheduled' WHERE status IN ('in_progress', 'completed')"
    )


def downgrade() -> None:
    # No-op: cannot recover which were originally completed vs in_progress
    pass
