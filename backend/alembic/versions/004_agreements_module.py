"""Migration 004 creating agreements table

Revision ID: 004_agreements_module
Revises: 003_profile_backend_fields
Create Date: 2026-08-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '004_agreements_module'
down_revision: Union[str, None] = '003_profile_backend_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'agreements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('agreement_number', sa.String(100), nullable=False, unique=True),
        sa.Column('type', sa.String(50), nullable=False, server_default='service_agreement'),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('consent_status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('description', sa.Text(), nullable=True),

        # PDF metadata
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True, server_default='application/pdf'),
        sa.Column('file_checksum', sa.String(64), nullable=True),

        # Dates & Signatures
        sa.Column('effective_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expiration_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('signed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('signed_by_name', sa.String(255), nullable=True),
        sa.Column('signed_by_email', sa.String(255), nullable=True),

        # Consent tracking
        sa.Column('consent_given_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('consent_notes', sa.Text(), nullable=True),

        # Foreign Keys
        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('parent_agreement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('agreements.id', ondelete='SET NULL'), nullable=True),

        # Base CRM Model audit timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index('ix_agreements_title', 'agreements', ['title'])
    op.create_index('ix_agreements_agreement_number', 'agreements', ['agreement_number'])
    op.create_index('ix_agreements_type', 'agreements', ['type'])
    op.create_index('ix_agreements_status', 'agreements', ['status'])
    op.create_index('ix_agreements_consent_status', 'agreements', ['consent_status'])
    op.create_index('ix_agreements_client_id', 'agreements', ['client_id'])
    op.create_index('ix_agreements_assigned_admin_id', 'agreements', ['assigned_admin_id'])
    op.create_index('ix_agreements_parent_agreement_id', 'agreements', ['parent_agreement_id'])


def downgrade() -> None:
    op.drop_table('agreements')
