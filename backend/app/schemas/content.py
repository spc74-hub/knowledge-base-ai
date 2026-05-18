"""
Content schemas (Pydantic models).

Post AI-pipeline removal: only the user-managed fields stay (no
classification, no embeddings, no AI-extracted metadata).
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, HttpUrl


class ContentBase(BaseModel):
    url: HttpUrl
    type: str = "web"
    title: str
    summary: Optional[str] = None


class ContentCreate(BaseModel):
    url: HttpUrl
    tags: List[str] = []
    process_async: bool = False  # Deprecated: AI pipeline removed. Kept for API compat; ignored.


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    user_tags: Optional[List[str]] = None
    user_note: Optional[str] = None
    user_category: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    note_category: Optional[str] = None  # For notes: idea, reflection, summary, project, reference


class ContentInDB(ContentBase):
    id: str
    user_id: str
    user_tags: List[str] = []
    user_note: Optional[str] = None
    user_category: Optional[str] = None
    is_favorite: bool = False
    is_archived: bool = False
    note_category: Optional[str] = None
    metadata: Optional[dict] = None
    source_metadata: Optional[dict] = None
    folder_id: Optional[str] = None
    project_id: Optional[str] = None
    area_id: Optional[str] = None
    view_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContentResponse(BaseModel):
    id: str
    url: str
    type: str
    title: str
    summary: Optional[str] = None
    user_tags: List[str] = []
    is_favorite: bool = False
    source_metadata: Optional[dict] = None
    created_at: str


class ContentDetailResponse(ContentResponse):
    description: Optional[str] = None
    user_note: Optional[str] = None
    user_category: Optional[str] = None
    note_category: Optional[str] = None
    is_archived: bool = False
    metadata: Optional[dict] = None
    folder_id: Optional[str] = None
    project_id: Optional[str] = None
    area_id: Optional[str] = None
    view_count: Optional[int] = None
    updated_at: str
