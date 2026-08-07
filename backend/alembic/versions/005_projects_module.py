"""Migration 005 creating projects table

Revision ID: 005_projects_module
Revises: 004_agreements_module
Create Date: 2026-08-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '005_projects_module'
down_revision: Union[str, None] = '004_agreements_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('project_code', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='not_started'),
        sa.Column('priority', sa.String(50), nullable=False, server_default='medium'),
        sa.Column('progress', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('budget', sa.Float(), nullable=True),
        sa.Column('currency', sa.String(10), nullable=True, server_default='INR'),

        # Timeline Dates
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_completion_date', sa.DateTime(timezone=True), nullable=True),

        # Foreign Keys
        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),

        # Base CRM Model audit timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index('ix_projects_name', 'projects', ['name'])
    op.create_index('ix_projects_project_code', 'projects', ['project_code'])
    op.create_index('ix_projects_status', 'projects', ['status'])
    op.create_index('ix_projects_priority', 'projects', ['priority'])
    op.create_index('ix_projects_client_id', 'projects', ['client_id'])
    op.create_index('ix_projects_assigned_admin_id', 'projects', ['assigned_admin_id'])


def downgrade() -> None:
    op.drop_table('projects')
