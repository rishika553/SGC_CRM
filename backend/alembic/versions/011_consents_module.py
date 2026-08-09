"""Migration 011 creating consents table

Revision ID: 011_consents_module
Revises: 010_settings_module
Create Date: 2026-08-09

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '011_consents_module'
down_revision: Union[str, None] = '010_settings_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'consents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),

        # Attachment metadata
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('file_checksum', sa.String(64), nullable=True),

        # Response tracking
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('denial_reason', sa.Text(), nullable=True),
        sa.Column('response_notes', sa.Text(), nullable=True),

        # Foreign Keys
        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('responded_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),

        # Base CRM Model audit timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index('ix_consents_title', 'consents', ['title'])
    op.create_index('ix_consents_status', 'consents', ['status'])
    op.create_index('ix_consents_client_id', 'consents', ['client_id'])
    op.create_index('ix_consents_responded_by_id', 'consents', ['responded_by_id'])


def downgrade() -> None:
    op.drop_table('consents')
