"""Migration 010 creating user_settings table and extending organizations table

Revision ID: 010_settings_module
Revises: 009_chat_module
Create Date: 2026-08-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '010_settings_module'
down_revision: Union[str, None] = '009_chat_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add company profile columns to organizations
    op.add_column('organizations', sa.Column('legal_name', sa.String(255), nullable=True))
    op.add_column('organizations', sa.Column('tax_id', sa.String(100), nullable=True))
    op.add_column('organizations', sa.Column('support_email', sa.String(255), nullable=True))
    op.add_column('organizations', sa.Column('phone', sa.String(50), nullable=True))
    op.add_column('organizations', sa.Column('logo_url', sa.String(500), nullable=True))
    op.add_column('organizations', sa.Column('address_line1', sa.String(255), nullable=True))
    op.add_column('organizations', sa.Column('address_line2', sa.String(255), nullable=True))
    op.add_column('organizations', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('organizations', sa.Column('state', sa.String(100), nullable=True))
    op.add_column('organizations', sa.Column('postal_code', sa.String(20), nullable=True))
    op.add_column('organizations', sa.Column('country', sa.String(100), nullable=True, server_default='India'))

    # 2. User Settings table
    op.create_table(
        'user_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('timezone', sa.String(100), nullable=False, server_default='Asia/Kolkata'),
        sa.Column('language', sa.String(20), nullable=False, server_default='en'),

        # Email Preferences
        sa.Column('email_notifications_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_digest_frequency', sa.String(50), nullable=False, server_default='daily'),
        sa.Column('invoice_email_alerts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('task_email_alerts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('chat_email_alerts', sa.Boolean(), nullable=False, server_default='true'),

        # In-App & Desktop Preferences
        sa.Column('in_app_notifications', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('desktop_notifications', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('task_assigned_alert', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('agreement_signed_alert', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('invoice_paid_alert', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('chat_mention_alert', sa.Boolean(), nullable=False, server_default='true'),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index('ix_user_settings_user_id', 'user_settings', ['user_id'])


def downgrade() -> None:
    op.drop_table('user_settings')
    op.drop_column('organizations', 'country')
    op.drop_column('organizations', 'postal_code')
    op.drop_column('organizations', 'state')
    op.drop_column('organizations', 'city')
    op.drop_column('organizations', 'address_line2')
    op.drop_column('organizations', 'address_line1')
    op.drop_column('organizations', 'logo_url')
    op.drop_column('organizations', 'phone')
    op.drop_column('organizations', 'support_email')
    op.drop_column('organizations', 'tax_id')
    op.drop_column('organizations', 'legal_name')
