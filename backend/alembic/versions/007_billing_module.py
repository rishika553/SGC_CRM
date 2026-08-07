"""Migration 007 creating invoices and invoice_payments tables

Revision ID: 007_billing_module
Revises: 006_tasks_module
Create Date: 2026-08-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '007_billing_module'
down_revision: Union[str, None] = '006_tasks_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Invoices table
    op.create_table(
        'invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('invoice_number', sa.String(100), nullable=False, unique=True),
        sa.Column('issue_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('currency', sa.String(10), nullable=False, server_default='INR'),
        sa.Column('subtotal', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('tax_rate', sa.Float(), nullable=False, server_default='18.0'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('total_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('paid_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('outstanding_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(50), nullable=False, server_default='unpaid'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('pdf_file_path', sa.String(500), nullable=True),

        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assigned_admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index('ix_invoices_invoice_number', 'invoices', ['invoice_number'])
    op.create_index('ix_invoices_issue_date', 'invoices', ['issue_date'])
    op.create_index('ix_invoices_due_date', 'invoices', ['due_date'])
    op.create_index('ix_invoices_status', 'invoices', ['status'])
    op.create_index('ix_invoices_client_id', 'invoices', ['client_id'])
    op.create_index('ix_invoices_project_id', 'invoices', ['project_id'])

    # 2. Invoice Payments table
    op.create_table(
        'invoice_payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('invoices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('payment_amount', sa.Float(), nullable=False),
        sa.Column('payment_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('payment_method', sa.String(100), nullable=False, server_default='Bank Transfer / NEFT'),
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recorded_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index('ix_invoice_payments_invoice_id', 'invoice_payments', ['invoice_id'])
    op.create_index('ix_invoice_payments_recorded_by_id', 'invoice_payments', ['recorded_by_id'])


def downgrade() -> None:
    op.drop_table('invoice_payments')
    op.drop_table('invoices')
