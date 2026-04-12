"""
SQLAlchemy model for contents table.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ARRAY, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from app.models.base import Base


class Content(Base):
    __tablename__ = "contents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # URL and type
    url = Column(Text, nullable=False)
    type = Column(String(50), nullable=False, default="web")

    # Schema.org classification
    schema_type = Column(String(100))
    schema_subtype = Column(String(100))

    # IAB Taxonomy
    iab_tier1 = Column(String(100))
    iab_tier2 = Column(String(200))
    iab_tier3 = Column(String(200))

    # Content
    title = Column(Text, nullable=False)
    summary = Column(Text)
    raw_content = Column(Text)
    description = Column(Text)

    # Concepts and entities
    concepts = Column(ARRAY(Text), default=[])
    entities = Column(JSONB, default={})

    # User classification overrides
    user_entities = Column(JSONB)
    user_concepts = Column(ARRAY(Text))
    user_category = Column(String(200))

    # Metadata
    language = Column(String(10), default="es")
    sentiment = Column(String(20))
    technical_level = Column(String(30))
    content_format = Column(String(50))
    reading_time_minutes = Column(Integer)
    view_count = Column(Integer)

    # Tags and user state
    user_tags = Column(ARRAY(Text), default=[])
    user_note = Column(Text)
    note_category = Column(String(50))
    is_favorite = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    is_asset = Column(Boolean, default=False)
    maturity_level = Column(String(30), default="captured")

    # Embedding for semantic search (1536 dimensions - OpenAI)
    embedding = Column(Vector(1536))

    # Metadata and relations
    metadata = Column(JSONB, default={})
    source_metadata = Column(JSONB, default={})
    processing_status = Column(String(20), default="pending")
    processing_error = Column(Text)

    # Foreign keys
    folder_id = Column(UUID(as_uuid=True))
    project_id = Column(UUID(as_uuid=True))
    area_id = Column(UUID(as_uuid=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    fetched_at = Column(DateTime(timezone=True))
    processed_at = Column(DateTime(timezone=True))
    last_reviewed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("user_id", "url", name="unique_user_url"),
    )
