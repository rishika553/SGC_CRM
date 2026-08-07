from typing import Optional, List, Tuple
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, and_, desc, asc

from app.models.chat import Conversation, ChatMessage
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class ChatRepository(BaseRepository[ChatMessage]):
    def __init__(self):
        super().__init__(ChatMessage)

    async def get_or_create_conversation(self, db: AsyncSession, user1_id: UUID, user2_id: UUID) -> Conversation:
        u1, u2 = (user1_id, user2_id) if user1_id < user2_id else (user2_id, user1_id)

        stmt = select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2)
        res = await db.execute(stmt)
        conv = res.scalar_one_or_none()

        if not conv:
            conv = Conversation(
                user1_id=u1,
                user2_id=u2,
                last_message_at=datetime.now(timezone.utc),
                created_by_id=user1_id,
                updated_by_id=user1_id,
            )
            db.add(conv)
            await db.commit()
            await db.refresh(conv)

        return conv

    async def list_user_conversations(self, db: AsyncSession, user_id: UUID) -> List[Conversation]:
        stmt = select(Conversation).options(
            selectinload(Conversation.user1).selectinload(User.role),
            selectinload(Conversation.user2).selectinload(User.role),
        ).where(
            or_(Conversation.user1_id == user_id, Conversation.user2_id == user_id)
        ).order_by(desc(Conversation.last_message_at))

        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_last_message(self, db: AsyncSession, conversation_id: UUID) -> Optional[ChatMessage]:
        stmt = select(ChatMessage).options(
            selectinload(ChatMessage.sender).selectinload(User.role),
            selectinload(ChatMessage.recipient).selectinload(User.role),
        ).where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.is_deleted == False
        ).order_by(desc(ChatMessage.created_at)).limit(1)

        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def count_unread_in_conversation(self, db: AsyncSession, conversation_id: UUID, user_id: UUID) -> int:
        stmt = select(func.count()).where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.recipient_id == user_id,
            ChatMessage.is_read == False,
            ChatMessage.is_deleted == False
        )
        res = await db.execute(stmt)
        return res.scalar_one()

    async def list_chat_history_paginated(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[ChatMessage], int]:
        query = select(ChatMessage).options(
            selectinload(ChatMessage.sender).selectinload(User.role),
            selectinload(ChatMessage.recipient).selectinload(User.role),
        ).where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.is_deleted == False
        )

        count_query = select(func.count()).select_from(query.subquery())
        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        offset = (page - 1) * page_size
        query = query.order_by(desc(ChatMessage.created_at)).offset(offset).limit(page_size)
        result = await db.execute(query)
        messages = list(reversed(result.scalars().all()))

        return messages, total

    async def mark_messages_read(self, db: AsyncSession, conversation_id: UUID, recipient_id: UUID) -> int:
        stmt = select(ChatMessage).where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.recipient_id == recipient_id,
            ChatMessage.is_read == False,
            ChatMessage.is_deleted == False
        )
        res = await db.execute(stmt)
        messages = list(res.scalars().all())

        if messages:
            now = datetime.now(timezone.utc)
            for msg in messages:
                msg.is_read = True
                msg.read_at = now
            await db.commit()

        return len(messages)


chat_repository = ChatRepository()
