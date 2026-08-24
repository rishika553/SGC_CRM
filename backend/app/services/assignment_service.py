from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.models.assignments import TaskAssignment, ProjectAssignment, ConsentAssignment, MeetingAssignment


async def sync_task_assignments(
    db: AsyncSession, task_id: UUID, assignee_ids: Optional[List[UUID]], assigned_by_id: Optional[UUID] = None
) -> None:
    if assignee_ids is None:
        return
    await db.execute(delete(TaskAssignment).where(TaskAssignment.task_id == task_id))
    for uid in assignee_ids:
        db.add(TaskAssignment(task_id=task_id, user_id=uid, assigned_by_id=assigned_by_id))
    await db.flush()


async def sync_project_assignments(
    db: AsyncSession, project_id: UUID, assignee_ids: Optional[List[UUID]], assigned_by_id: Optional[UUID] = None
) -> None:
    if assignee_ids is None:
        return
    await db.execute(delete(ProjectAssignment).where(ProjectAssignment.project_id == project_id))
    for uid in assignee_ids:
        db.add(ProjectAssignment(project_id=project_id, user_id=uid, assigned_by_id=assigned_by_id))
    await db.flush()


async def sync_consent_assignments(
    db: AsyncSession, consent_id: UUID, assignee_ids: Optional[List[UUID]], assigned_by_id: Optional[UUID] = None
) -> None:
    if assignee_ids is None:
        return
    await db.execute(delete(ConsentAssignment).where(ConsentAssignment.consent_id == consent_id))
    for uid in assignee_ids:
        db.add(ConsentAssignment(consent_id=consent_id, user_id=uid, assigned_by_id=assigned_by_id))
    await db.flush()


async def sync_meeting_assignments(
    db: AsyncSession, meeting_id: UUID, assignee_ids: Optional[List[UUID]], assigned_by_id: Optional[UUID] = None
) -> None:
    if assignee_ids is None:
        return
    await db.execute(delete(MeetingAssignment).where(MeetingAssignment.meeting_id == meeting_id))
    for uid in assignee_ids:
        db.add(MeetingAssignment(meeting_id=meeting_id, user_id=uid, assigned_by_id=assigned_by_id))
    await db.flush()
