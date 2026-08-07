"""Migration 008 creating documents table

Revision ID: 008_documents_module
Revises: 007_billing_module
Create Date: 2026-08-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '008_documents_module'
down_revision: Union[str, None] = '007_billing_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('storage_type', sa.String(50), nullable=False, server_default='supabase'),
        sa.Column('public_url', sa.String(1000), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('mime_type', sa.String(100), nullable=False, server_default='application/octet-stream'),
        sa.Column('file_extension', sa.String(20), nullable=True),
        sa.Column('file_checksum', sa.String(64), nullable=True),
        sa.Column('category', sa.String(50), nullable=False, server_default='other'),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_secured', sa.Boolean(), nullable=False, server_default='true'),

        # Foreign Keys
        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=True),
        sa.Column('uploaded_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('parent_document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('documents.id', ondelete='SET NULL'), nullable=True),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index('ix_documents_title', 'documents', ['title'])
    op.create_index('ix_documents_file_name', 'documents', ['file_name'])
    op.create_index('ix_documents_category', 'documents', ['category'])
    op.create_index('ix_documents_client_id', 'documents', ['client_id'])
    op.create_index('ix_documents_project_id', 'documents', ['project_id'])
    op.create_index('ix_documents_uploaded_by_id', 'documents', ['uploaded_by_id'])
    op.create_index('ix_documents_parent_document_id', 'documents', ['parent_document_id'])


def downgrade() -> None:
    op.drop_table('documents')
