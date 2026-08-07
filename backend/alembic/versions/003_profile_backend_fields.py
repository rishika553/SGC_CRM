"""Migration 003 adding profile backend fields to clients table (GST, PAN, address, primary contact, assigned admin)

Revision ID: 003_profile_backend_fields
Revises: 002_clients_and_contacts
Create Date: 2026-08-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '003_profile_backend_fields'
down_revision: Union[str, None] = '002_clients_and_contacts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new profile columns to clients table
    op.add_column('clients', sa.Column('legal_name', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('company_type', sa.String(100), nullable=True))
    op.add_column('clients', sa.Column('currency', sa.String(10), nullable=True, server_default='INR'))
    op.add_column('clients', sa.Column('gst_number', sa.String(15), nullable=True))
    op.add_column('clients', sa.Column('pan_number', sa.String(10), nullable=True))
    op.add_column('clients', sa.Column('primary_contact_name', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('email', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('phone', sa.String(50), nullable=True))
    op.add_column('clients', sa.Column('address_line1', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('address_line2', sa.String(255), nullable=True))
    op.add_column('clients', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('clients', sa.Column('state', sa.String(100), nullable=True))
    op.add_column('clients', sa.Column('postal_code', sa.String(20), nullable=True))
    op.add_column('clients', sa.Column('country', sa.String(100), nullable=True, server_default='India'))
    op.add_column('clients', sa.Column('assigned_admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))

    # Add indexes for efficient search & filter
    op.create_index('ix_clients_gst_number', 'clients', ['gst_number'])
    op.create_index('ix_clients_pan_number', 'clients', ['pan_number'])
    op.create_index('ix_clients_email', 'clients', ['email'])
    op.create_index('ix_clients_city', 'clients', ['city'])
    op.create_index('ix_clients_state', 'clients', ['state'])
    op.create_index('ix_clients_assigned_admin_id', 'clients', ['assigned_admin_id'])


def downgrade() -> None:
    op.drop_index('ix_clients_assigned_admin_id', table_name='clients')
    op.drop_index('ix_clients_state', table_name='clients')
    op.drop_index('ix_clients_city', table_name='clients')
    op.drop_index('ix_clients_email', table_name='clients')
    op.drop_index('ix_clients_pan_number', table_name='clients')
    op.drop_index('ix_clients_gst_number', table_name='clients')

    op.drop_column('clients', 'assigned_admin_id')
    op.drop_column('clients', 'country')
    op.drop_column('clients', 'postal_code')
    op.drop_column('clients', 'state')
    op.drop_column('clients', 'city')
    op.drop_column('clients', 'address_line2')
    op.drop_column('clients', 'address_line1')
    op.drop_column('clients', 'phone')
    op.drop_column('clients', 'email')
    op.drop_column('clients', 'primary_contact_name')
    op.drop_column('clients', 'pan_number')
    op.drop_column('clients', 'gst_number')
    op.drop_column('clients', 'currency')
    op.drop_column('clients', 'company_type')
    op.drop_column('clients', 'legal_name')
