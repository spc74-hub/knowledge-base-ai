"""SQLAlchemy models for habits."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, Date, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class Habit(Base):
    __tablename__ = "habits"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(Text, nullable=False)
    description = Column(Text)
    icon = Column(Text, default="✅")
    color = Column(Text, default="#10b981")
    frequency_type = Column(String(20), default="daily")
    frequency_days = Column(ARRAY(Integer), default=[0, 1, 2, 3, 4, 5, 6])
    target_count = Column(Integer, default=1)
    target_time = Column(String(10))
    time_of_day = Column(String(20), default="anytime")
    reminder_enabled = Column(Boolean, default=False)
    reminder_time = Column(String(10))
    area_id = Column(UUID(as_uuid=True))
    objective_id = Column(UUID(as_uuid=True))
    is_active = Column(Boolean, default=True)
    archived_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class HabitLog(Base):
    __tablename__ = "habit_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    habit_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    date = Column(String(10), nullable=False)
    status = Column(String(20), default="completed")
    value = Column(Integer, default=1)
    notes = Column(Text)
    is_scheduled = Column(Boolean)
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
