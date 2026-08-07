from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ResponseEnvelope(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None


class PaginationMeta(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    data: List[T]
    meta: PaginationMeta


class PaginationQueryParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Page number starting from 1")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page (max 100)")
    search: Optional[str] = Field(default=None, description="Search query")
    sort_by: Optional[str] = Field(default="created_at", description="Field to sort by")
    sort_order: Optional[str] = Field(default="desc", description="Sort order: asc or desc")


def build_paginated_response(
    items: List[T],
    total: int,
    page: int,
    page_size: int
) -> PaginatedResponse[T]:
    """
    Helper function to build a standardized PaginatedResponse envelope.
    """
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return PaginatedResponse(
        success=True,
        data=items,
        meta=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )
    )
