"""Migration 019 multi-RM assignments (junction tables)

Revision ID: 019_multi_rm_assignments
Revises: 018_add_missing_columns
Create Date: 2026-08-23
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '019_multi_rm_assignments'
down_revision: Union[str, None] = '018_add_missing_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # --- Task Assignments ---
    op.create_table(
        'task_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('task_id', 'user_id', name='uq_task_assignment'),
    )
    op.create_index('ix_task_assignments_task', 'task_assignments', ['task_id'])
    op.create_index('ix_task_assignments_user', 'task_assignments', ['user_id'])

    # Migrate existing assigned_to_id → task_assignments
    bind.execute(sa.text("""
        INSERT INTO task_assignments (id, task_id, user_id, assigned_at)
        SELECT gen_random_uuid(), id, assigned_to_id, created_at
        FROM tasks
        WHERE assigned_to_id IS NOT NULL AND is_deleted = false
    """))

    # --- Project Assignments ---
    op.create_table(
        'project_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('project_id', 'user_id', name='uq_project_assignment'),
    )
    op.create_index('ix_project_assignments_project', 'project_assignments', ['project_id'])
    op.create_index('ix_project_assignments_user', 'project_assignments', ['user_id'])

    # Migrate existing assigned_admin_id → project_assignments
    bind.execute(sa.text("""
        INSERT INTO project_assignments (id, project_id, user_id, assigned_at)
        SELECT gen_random_uuid(), id, assigned_admin_id, created_at
        FROM projects
        WHERE assigned_admin_id IS NOT NULL AND is_deleted = false
    """))

    # --- Consent Assignments ---
    op.create_table(
        'consent_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('consent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('consents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('consent_id', 'user_id', name='uq_consent_assignment'),
    )
    op.create_index('ix_consent_assignments_consent', 'consent_assignments', ['consent_id'])
    op.create_index('ix_consent_assignments_user', 'consent_assignments', ['user_id'])

    # --- Meeting Assignments ---
    op.create_table(
        'meeting_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('meeting_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('meetings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('meeting_id', 'user_id', name='uq_meeting_assignment'),
    )
    op.create_index('ix_meeting_assignments_meeting', 'meeting_assignments', ['meeting_id'])
    op.create_index('ix_meeting_assignments_user', 'meeting_assignments', ['user_id'])


def downgrade() -> None:
    op.drop_table('meeting_assignments')
    op.drop_table('consent_assignments')
    op.drop_table('project_assignments')
    op.drop_table('task_assignments')
