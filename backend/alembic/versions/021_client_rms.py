"""Create client_rms junction table for multi-RM per client with role labels.

Revision ID: 021
Revises: 020_meeting_remove_in_progress
Create Date: 2026-08-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "021_client_rms"
down_revision = "020_meeting_remove_in_progress"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_rms",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("role_label", sa.String(100), nullable=True),
        sa.Column("assigned_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("client_id", "user_id", name="uq_client_rm"),
    )


def downgrade() -> None:
    op.drop_table("client_rms")
