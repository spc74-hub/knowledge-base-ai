"""
Content schemas (Pydantic models).
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, HttpUrl, Field


class EntityPerson(BaseModel):
    name: str
    role: Optional[str] = None
    organization: Optional[str] = None


class EntityOrganization(BaseModel):
    name: str
    type: Optional[str] = None


class EntityPlace(BaseModel):
    name: str
    type: Optional[str] = None
    country: Optional[str] = None


class EntityProduct(BaseModel):
    name: str
    type: Optional[str] = None
    company: Optional[str] = None


class Entities(BaseModel):
    persons: List[EntityPerson] = []
    organizations: List[EntityOrganization] = []
    places: List[EntityPlace] = []
    products: List[EntityProduct] = []


class Classification(BaseModel):
    """Classification result from Claude."""
    schema_type: str
    schema_subtype: Optional[str] = None
    iab_tier1: str
    iab_tier2: Optional[str] = None
    iab_tier3: Optional[str] = None
    concepts: List[str] = []
    entities: Entities = Entities()
    language: str = "es"
    sentiment: str = "neutral"
    technical_level: str = "intermediate"
    content_format: str = "article"


class ContentBase(BaseModel):
    url: HttpUrl
    type: str = "web"
    title: str
    summary: Optional[str] = None


class ContentCreate(BaseModel):
    url: HttpUrl
    tags: List[str] = []
    process_async: bool = False


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    user_tags: Optional[List[str]] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None


class ContentInDB(ContentBase):
    id: str
    user_id: str
    schema_type: Optional[str] = None
    schema_subtype: Optional[str] = None
    iab_tier1: Optional[str] = None
    iab_tier2: Optional[str] = None
    iab_tier3: Optional[str] = None
    raw_content: Optional[str] = None
    concepts: List[str] = []
    entities: Optional[dict] = None
    language: Optional[str] = None
    sentiment: Optional[str] = None
    technical_level: Optional[str] = None
    content_format: Optional[str] = None
    reading_time_minutes: Optional[int] = None
    user_tags: List[str] = []
    is_favorite: bool = False
    is_archived: bool = False
    processing_status: str = "pending"
    metadata: Optional[dict] = None
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
    schema_type: Optional[str] = None
    iab_tier1: Optional[str] = None
    concepts: List[str] = []
    user_tags: List[str] = []
    is_favorite: bool = False
    processing_status: str = "pending"
    created_at: str


class ContentDetailResponse(ContentResponse):
    schema_subtype: Optional[str] = None
    iab_tier2: Optional[str] = None
    iab_tier3: Optional[str] = None
    raw_content: Optional[str] = None
    entities: Optional[dict] = None
    language: Optional[str] = None
    sentiment: Optional[str] = None
    technical_level: Optional[str] = None
    content_format: Optional[str] = None
    reading_time_minutes: Optional[int] = None
    is_archived: bool = False
    metadata: Optional[dict] = None
    updated_at: str
