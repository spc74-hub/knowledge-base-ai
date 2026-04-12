"""SQLAlchemy models for daily journal."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base


class DailyJournal(Base):
    __tablename__ = "daily_journal"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    date = Column(Date, nullable=False)
    morning_intention = Column(Text)
    energy_morning = Column(String(20))
    inspirational_content = Column(JSONB, default={})
    # Big rocks (new array system)
    big_rocks = Column(JSONB, default=[])
    big_rocks_count = Column(Integer, default=3)
    # Legacy big rock fields
    big_rock_type = Column(String(20))
    big_rock_id = Column(UUID(as_uuid=True))
    big_rock_text = Column(Text)
    big_rock_completed = Column(Boolean, default=False)
    # During the day
    energy_noon = Column(String(20))
    energy_afternoon = Column(String(20))
    energy_night = Column(String(20))
    daily_tasks = Column(JSONB, default=[])
    commitments = Column(JSONB, default=[])
    quick_captures = Column(JSONB, default=[])
    # Evening section
    wins = Column(JSONB, default=[])
    learnings = Column(Text)
    gratitudes = Column(JSONB, default=[])
    failures = Column(Text)
    forgiveness = Column(Text)
    forgiveness_items = Column(JSONB, default=[])
    do_different = Column(Text)
    note_to_tomorrow = Column(Text)
    day_rating = Column(Integer)
    day_word = Column(String(50))
    # Metadata
    is_morning_completed = Column(Boolean, default=False)
    is_day_completed = Column(Boolean, default=False)
    is_evening_completed = Column(Boolean, default=False)
    generated_note_id = Column(UUID(as_uuid=True))
    ai_summary = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("user_id", "date"),)


class InspirationalContent(Base):
    __tablename__ = "inspirational_content"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    author = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
