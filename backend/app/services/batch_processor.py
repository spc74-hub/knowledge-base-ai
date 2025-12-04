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
from app.services.fetcher import fetcher_service
from app.services.url_normalizer import normalize_url

logger = logging.getLogger(__name__)


class BatchProcessorService:
    """
    Background service that periodically processes pending content.
    """

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._is_running = False
        self._interval_seconds = 900  # 15 minutes default
        self._batch_size = 50  # Items per user per run

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
        """Process queued (unfetched) and pending content for all users."""
        try:
            db = get_supabase_admin_client()

            # PHASE 1: Fetch queued URLs (no content yet)
            await self._fetch_queued_urls(db)

            # PHASE 2: Process pending content (AI enrichment)
            await self._process_pending_content(db)

        except Exception as e:
            logger.error(f"Error in _process_all_users: {e}")

    async def _fetch_queued_urls(self, db):
        """Fetch content for queued URLs."""
        try:
            # Get queued URLs (limit to batch size)
            queued = db.table("contents").select(
                "id, url, user_id, metadata"
            ).eq(
                "processing_status", "queued"
            ).limit(self._batch_size).execute()

            if not queued.data:
                logger.info("No queued URLs to fetch")
                return

            logger.info(f"Fetching {len(queued.data)} queued URLs")
            fetched = 0
            failed = 0

            for item in queued.data:
                try:
                    # Get original URL from metadata or use stored URL
                    metadata = item.get("metadata") or {}
                    original_url = metadata.get("original_url", item["url"])

                    # Fetch content with timeout
                    try:
                        fetch_result = await asyncio.wait_for(
                            fetcher_service.fetch(original_url),
                            timeout=30.0
                        )
                    except asyncio.TimeoutError:
                        db.table("contents").update({
                            "processing_status": "failed",
                            "processing_error": "Timeout al obtener contenido"
                        }).eq("id", item["id"]).execute()
                        failed += 1
                        continue

                    if not fetch_result.success:
                        db.table("contents").update({
                            "processing_status": "failed",
                            "processing_error": f"Fetch error: {fetch_result.error}"
                        }).eq("id", item["id"]).execute()
                        failed += 1
                        continue

                    # Update with fetched content
                    word_count = len(fetch_result.content.split())
                    reading_time = max(1, word_count // 200)

                    db.table("contents").update({
                        "type": fetch_result.type,
                        "title": fetch_result.title,
                        "raw_content": fetch_result.content[:50000],
                        "reading_time_minutes": reading_time,
                        "metadata": {**metadata, **fetch_result.metadata} if fetch_result.metadata else metadata,
                        "processing_status": "pending"  # Ready for AI processing
                    }).eq("id", item["id"]).execute()
                    fetched += 1

                except Exception as e:
                    logger.error(f"Error fetching URL {item['url']}: {e}")
                    db.table("contents").update({
                        "processing_status": "failed",
                        "processing_error": str(e)[:100]
                    }).eq("id", item["id"]).execute()
                    failed += 1

            logger.info(f"Fetch complete: {fetched} fetched, {failed} failed")

        except Exception as e:
            logger.error(f"Error in _fetch_queued_urls: {e}")

    async def _process_pending_content(self, db):
        """Process pending content (AI enrichment)."""
        try:
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
                        limit=self._batch_size  # Configurable batch size
                    )
                    total_processed += result.get("processed", 0)
                    total_failed += result.get("failed", 0)
                    logger.info(f"User {user_id}: processed {result.get('processed', 0)}, failed {result.get('failed', 0)}")
                except Exception as e:
                    logger.error(f"Error processing user {user_id}: {e}")

            logger.info(f"AI processing complete: {total_processed} processed, {total_failed} failed")

        except Exception as e:
            logger.error(f"Error in _process_pending_content: {e}")

    async def run_once(self):
        """Run processing once (manual trigger)."""
        logger.info("Running batch processor once (manual trigger)")
        await self._process_all_users()


# Singleton instance
batch_processor = BatchProcessorService()


# FastAPI lifespan events
async def start_batch_processor():
    """Start batch processor on app startup."""
    await batch_processor.start(interval_seconds=900)  # Every 15 minutes


async def stop_batch_processor():
    """Stop batch processor on app shutdown."""
    await batch_processor.stop()
