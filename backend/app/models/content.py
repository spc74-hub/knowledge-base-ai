"""
SQLAlchemy model for contents table.

Post AI-pipeline removal (CHANGELOG 2026-05-18): only the columns Kbia
actually needs as the strategic layer are kept. Heavy AI columns
(embedding, raw_content, concepts, entities, iab_tier*, schema_*,
sentiment, technical_level, content_format, reading_time_minutes,
language, maturity_level, processing_status/_error, processed_at,
last_reviewed_at) are dropped via migration 004.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ARRAY, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base


class Content(Base):
    __tablename__ = "contents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # URL and type
    url = Column(Text, nullable=False)
    type = Column(String(50), nullable=False, default="web")

    # Content
    title = Column(Text, nullable=False)
    summary = Column(Text)
    description = Column(Text)

    # User classification override (kept — used in dashboard/explorer filters)
    user_category = Column(String(200))

    # User state
    user_tags = Column(ARRAY(Text), default=[])
    user_note = Column(Text)
    note_category = Column(String(50))
    is_favorite = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    is_asset = Column(Boolean, default=False)

    # View count (kept — used for sorting in explorer)
    view_count = Column(Integer)

    # Metadata and relations
    content_metadata = Column("metadata", JSONB, default={})
    source_metadata = Column(JSONB, default={})

    # Foreign keys
    folder_id = Column(UUID(as_uuid=True))
    project_id = Column(UUID(as_uuid=True))
    area_id = Column(UUID(as_uuid=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    fetched_at = Column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("user_id", "url", name="unique_user_url"),
    )
