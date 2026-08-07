"""Migration 009 creating conversations and chat_messages tables

Revision ID: 009_chat_module
Revises: 008_documents_module
Create Date: 2026-08-03

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '009_chat_module'
down_revision: Union[str, None] = '008_documents_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Conversations table
    op.create_table(
        'conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user1_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user2_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=False),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),

        sa.UniqueConstraint('user1_id', 'user2_id', name='uq_conversation_users')
    )

    op.create_index('ix_conversations_user1_id', 'conversations', ['user1_id'])
    op.create_index('ix_conversations_user2_id', 'conversations', ['user2_id'])
    op.create_index('ix_conversations_last_message_at', 'conversations', ['last_message_at'])

    # 2. Chat Messages table
    op.create_table(
        'chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('recipient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('message_type', sa.String(50), nullable=False, server_default='text'),
        sa.Column('content', sa.Text(), nullable=True),

        # Attachments
        sa.Column('attachment_url', sa.String(1000), nullable=True),
        sa.Column('attachment_name', sa.String(255), nullable=True),
        sa.Column('attachment_type', sa.String(100), nullable=True),
        sa.Column('attachment_size', sa.Integer(), nullable=True),

        # Read Receipts
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index('ix_chat_messages_conversation_id', 'chat_messages', ['conversation_id'])
    op.create_index('ix_chat_messages_sender_id', 'chat_messages', ['sender_id'])
    op.create_index('ix_chat_messages_recipient_id', 'chat_messages', ['recipient_id'])
    op.create_index('ix_chat_messages_is_read', 'chat_messages', ['is_read'])


def downgrade() -> None:
    op.drop_table('chat_messages')
    op.drop_table('conversations')
