"""Migration 014 removing DocuSign e-signature columns from consents

Revision ID: 014_remove_docusign
Revises: 013_consents_docusign
Create Date: 2026-08-15

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '014_remove_docusign'
down_revision: Union[str, None] = '013_consents_docusign'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_consents_docusign_envelope_id', table_name='consents')
    op.drop_column('consents', 'docusign_signed_at')
    op.drop_column('consents', 'docusign_sent_at')
    op.drop_column('consents', 'docusign_status')
    op.drop_column('consents', 'docusign_signing_url')
    op.drop_column('consents', 'docusign_envelope_id')


def downgrade() -> None:
    op.add_column('consents', sa.Column('docusign_envelope_id', sa.String(255), nullable=True))
    op.add_column('consents', sa.Column('docusign_signing_url', sa.String(2000), nullable=True))
    op.add_column('consents', sa.Column('docusign_status', sa.String(50), nullable=True))
    op.add_column('consents', sa.Column('docusign_sent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('consents', sa.Column('docusign_signed_at', sa.DateTime(timezone=True), nullable=True))

    op.create_index('ix_consents_docusign_envelope_id', 'consents', ['docusign_envelope_id'])
