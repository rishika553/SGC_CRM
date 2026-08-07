"""Migration 002 creating clients, contacts, and communication_logs tables

Revision ID: 002_clients_and_contacts
Revises: 001_initial_schema
Create Date: 2026-08-02

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '002_clients_and_contacts'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Clients table
    op.create_table(
        'clients',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('industry', sa.String(100), nullable=True),
        sa.Column('company_size', sa.String(50), nullable=True),
        sa.Column('website', sa.String(255), nullable=True),
        sa.Column('billing_address', sa.Text(), nullable=True),
        sa.Column('annual_revenue', sa.Float(), nullable=True),
        sa.Column('tier', sa.String(50), nullable=False, server_default='mid_market'),
        sa.Column('status', sa.String(50), nullable=False, server_default='prospect'),
        sa.Column('account_manager_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index('ix_clients_name', 'clients', ['name'])
    op.create_index('ix_clients_industry', 'clients', ['industry'])
    op.create_index('ix_clients_tier', 'clients', ['tier'])
    op.create_index('ix_clients_status', 'clients', ['status'])

    # 2. Create Contacts table
    op.create_table(
        'contacts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('job_title', sa.String(100), nullable=True),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('is_primary_contact', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index('ix_contacts_email', 'contacts', ['email'])
    op.create_index('ix_contacts_client_id', 'contacts', ['client_id'])

    # 3. Create Communication Logs table
    op.create_table(
        'communication_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('contact_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('contacts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('logged_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('type', sa.String(50), nullable=False, server_default='meeting'),
        sa.Column('subject', sa.String(255), nullable=False),
        sa.Column('notes', sa.Text(), nullable=False),
        sa.Column('interaction_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index('ix_communication_logs_client_id', 'communication_logs', ['client_id'])
    op.create_index('ix_communication_logs_type', 'communication_logs', ['type'])


def downgrade() -> None:
    op.drop_table('communication_logs')
    op.drop_table('contacts')
    op.drop_table('clients')
