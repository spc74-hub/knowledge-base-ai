"""
Background batch processor service.
Runs periodically to process pending content automatically.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from app.db.session import get_supabase_admin_client
from app.services.processor import processor_service

logger = logging.getLogger(__name__)


class BatchProcessorService:
    """
    Background service that periodically processes pending content.
    """

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._is_running = False
        self._interval_seconds = 3600  # 1 hour default

    @property
    def is_running(self) -> bool:
        return self._is_running

    async def start(self, interval_seconds: int = 3600):
        """
        Start the background processor.

        Args:
            interval_seconds: Interval between processing runs (default: 1 hour)
        """
        if self._is_running:
            logger.warning("Batch processor is already running")
            return

        self._interval_seconds = interval_seconds
        self._is_running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(f"Batch processor started with {interval_seconds}s interval")

    async def stop(self):
        """Stop the background processor."""
        if not self._is_running:
            return

        self._is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Batch processor stopped")

    async def _run_loop(self):
        """Main processing loop."""
        while self._is_running:
            try:
                await self._process_all_users()
            except Exception as e:
                logger.error(f"Error in batch processor: {e}")

            # Wait for next interval
            await asyncio.sleep(self._interval_seconds)

    async def _process_all_users(self):
        """Process pending content for all users."""
        try:
            db = get_supabase_admin_client()

            # Get all users with pending content
            pending_users = db.table("contents").select(
                "user_id",
                count="exact"
            ).eq(
                "processing_status", "pending"
            ).execute()

            if not pending_users.data:
                logger.info("No pending content to process")
                return

            # Get unique user IDs
            user_ids = list(set(row["user_id"] for row in pending_users.data))
            logger.info(f"Found {len(user_ids)} users with pending content")

            total_processed = 0
            total_failed = 0

            for user_id in user_ids:
                try:
                    result = await processor_service.process_pending(
                        db=db,
                        user_id=user_id,
                        limit=20  # Process up to 20 items per user per run
                    )
                    total_processed += result.get("processed", 0)
                    total_failed += result.get("failed", 0)
                    logger.info(f"User {user_id}: processed {result.get('processed', 0)}, failed {result.get('failed', 0)}")
                except Exception as e:
                    logger.error(f"Error processing user {user_id}: {e}")

            logger.info(f"Batch complete: {total_processed} processed, {total_failed} failed")

        except Exception as e:
            logger.error(f"Error in _process_all_users: {e}")

    async def run_once(self):
        """Run processing once (manual trigger)."""
        logger.info("Running batch processor once (manual trigger)")
        await self._process_all_users()


# Singleton instance
batch_processor = BatchProcessorService()


# FastAPI lifespan events
async def start_batch_processor():
    """Start batch processor on app startup."""
    await batch_processor.start(interval_seconds=3600)  # Every hour


async def stop_batch_processor():
    """Stop batch processor on app shutdown."""
    await batch_processor.stop()
