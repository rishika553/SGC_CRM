"""Migration 006 creating tasks and task_comments tables

Revision ID: 006_tasks_module
Revises: 005_projects_module
Create Date: 2026-08-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '006_tasks_module'
down_revision: Union[str, None] = '005_projects_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Tasks table
    op.create_table(
        'tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('task_code', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='todo'),
        sa.Column('priority', sa.String(50), nullable=False, server_default='medium'),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),

        # Foreign Keys
        sa.Column('assigned_to_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=True),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=True),
        sa.Column('parent_task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=True),

        # Base CRM Model audit timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index('ix_tasks_title', 'tasks', ['title'])
    op.create_index('ix_tasks_task_code', 'tasks', ['task_code'])
    op.create_index('ix_tasks_status', 'tasks', ['status'])
    op.create_index('ix_tasks_priority', 'tasks', ['priority'])
    op.create_index('ix_tasks_due_date', 'tasks', ['due_date'])
    op.create_index('ix_tasks_assigned_to_id', 'tasks', ['assigned_to_id'])
    op.create_index('ix_tasks_project_id', 'tasks', ['project_id'])
    op.create_index('ix_tasks_client_id', 'tasks', ['client_id'])
    op.create_index('ix_tasks_parent_task_id', 'tasks', ['parent_task_id'])

    # 2. Create Task Comments table
    op.create_table(
        'task_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index('ix_task_comments_task_id', 'task_comments', ['task_id'])
    op.create_index('ix_task_comments_user_id', 'task_comments', ['user_id'])


def downgrade() -> None:
    op.drop_table('task_comments')
    op.drop_table('tasks')
