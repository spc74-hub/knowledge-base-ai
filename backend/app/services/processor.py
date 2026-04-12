"""
Content processing service.
Handles deferred processing of content (classification, summarization, embedding).
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional, List

from app.services.classifier import classifier_service
from app.services.summarizer import summarizer_service
from app.services.embeddings import embeddings_service
from app.services.usage_tracker import usage_tracker
from app.services.fetcher import fetcher_service


class ProcessorService:
    """
    Service for processing content (classify, summarize, embed).
    Can process individual items or batches.
    """

    def __init__(self):
        self._background_task: Optional[asyncio.Task] = None
        self._is_running = False

    async def process_content(
        self,
        db,
        content_id: str,
        user_id: str
    ) -> dict:
        """
        Process a single content item.

        Args:
            db: Supabase client
            content_id: ID of content to process
            user_id: User ID for usage tracking

        Returns:
            dict with success status and message
        """
        try:
            # Get content
            response = await db.table("contents").select("*").eq("id", content_id).eq("user_id", user_id).single().execute()

            if not response.data:
                return {"success": False, "error": "Content not found"}

            content = response.data

            # Check if already processing
            if content.get("processing_status") == "processing":
                return {"success": False, "error": "Content is already being processed"}

            # Mark as processing
            await db.table("contents").update({
                "processing_status": "processing"
            }).eq("id", content_id).execute()

            # Set up usage tracker
            usage_tracker.set_db(db)

            # Get raw content and title
            title = content.get("title", "")
            raw_content = content.get("raw_content", "")
            url = content.get("url", "")
            metadata = content.get("metadata") or {}

            # If no raw_content, try to fetch it first
            if not raw_content and url:
                try:
                    original_url = metadata.get("original_url", url)
                    fetch_result = await asyncio.wait_for(
                        fetcher_service.fetch(original_url),
                        timeout=30.0
                    )
                    if fetch_result.success and fetch_result.content:
                        raw_content = fetch_result.content[:50000]
                        title = fetch_result.title or title
                        # Update content with fetched data
                        await db.table("contents").update({
                            "raw_content": raw_content,
                            "title": title,
                            "type": fetch_result.type,
                            "metadata": {**metadata, **fetch_result.metadata} if fetch_result.metadata else metadata
                        }).eq("id", content_id).execute()
                    else:
                        await db.table("contents").update({
                            "processing_status": "failed",
                            "processing_error": f"Fetch error: {fetch_result.error or 'No content returned'}"
                        }).eq("id", content_id).execute()
                        return {"success": False, "error": f"Fetch error: {fetch_result.error or 'No content returned'}"}
                except asyncio.TimeoutError:
                    await db.table("contents").update({
                        "processing_status": "failed",
                        "processing_error": "Timeout al obtener contenido"
                    }).eq("id", content_id).execute()
                    return {"success": False, "error": "Timeout al obtener contenido"}
                except Exception as fetch_err:
                    await db.table("contents").update({
                        "processing_status": "failed",
                        "processing_error": f"Fetch error: {str(fetch_err)}"
                    }).eq("id", content_id).execute()
                    return {"success": False, "error": f"Fetch error: {str(fetch_err)}"}

            if not raw_content:
                await db.table("contents").update({
                    "processing_status": "failed",
                    "processing_error": "No content to process and no URL to fetch"
                }).eq("id", content_id).execute()
                return {"success": False, "error": "No content to process and no URL to fetch"}

            # Step 1: Classify content
            classification = await classifier_service.classify(
                title=title,
                content=raw_content,
                url=url,
                user_id=user_id
            )

            # Step 2: Generate summary
            summary = await summarizer_service.summarize(
                title=title,
                content=raw_content,
                language=classification.language,
                user_id=user_id
            )

            # Step 3: Calculate reading time
            word_count = len(raw_content.split())
            reading_time = max(1, word_count // 200)

            # Step 4: Generate embedding
            embedding_text = embeddings_service.prepare_content_for_embedding(
                title=title,
                summary=summary,
                content=raw_content,
                concepts=classification.concepts,
                entities=classification.entities.model_dump() if classification.entities else None,
                metadata=content.get("metadata")
            )
            embedding = await embeddings_service.generate_embedding(
                embedding_text,
                user_id=user_id,
                operation="content_embedding"
            )

            # Update content with processed data
            update_data = {
                "summary": summary,
                "schema_type": classification.schema_type,
                "schema_subtype": classification.schema_subtype,
                "iab_tier1": classification.iab_tier1,
                "iab_tier2": classification.iab_tier2,
                "iab_tier3": classification.iab_tier3,
                "concepts": classification.concepts,
                "entities": classification.entities.model_dump() if classification.entities else {},
                "language": classification.language,
                "sentiment": classification.sentiment,
                "technical_level": classification.technical_level,
                "content_format": classification.content_format,
                "reading_time_minutes": reading_time,
                "embedding": embedding,
                "processing_status": "completed",
                "processing_error": None,
                "processed_at": datetime.now(timezone.utc).isoformat()
            }

            await db.table("contents").update(update_data).eq("id", content_id).execute()

            return {
                "success": True,
                "message": "Content processed successfully",
                "content_id": content_id,
                "title": title
            }

        except Exception as e:
            # Mark as failed
            try:
                await db.table("contents").update({
                    "processing_status": "failed",
                    "processing_error": str(e)
                }).eq("id", content_id).execute()
            except:
                pass

            return {"success": False, "error": str(e)}

    async def process_pending(
        self,
        db,
        user_id: str,
        limit: Optional[int] = None
    ) -> dict:
        """
        Process all pending content for a user.

        Args:
            db: CompatDB instance
            user_id: User ID
            limit: Maximum items to process (None = all pending)

        Returns:
            dict with processing results
        """
        try:
            # Get ALL pending content - process_content will fetch content if needed
            query = db.table("contents").select("id, title, url").eq("user_id", user_id).eq("processing_status", "pending")
            if limit is not None:
                query = query.limit(limit)
            response = await query.execute()

            if not response.data:
                return {
                    "success": True,
                    "message": "No pending content to process",
                    "processed": 0,
                    "failed": 0,
                    "results": []
                }

            results = []
            processed = 0
            failed = 0

            for content in response.data:
                result = await self.process_content(db, content["id"], user_id)
                results.append({
                    "content_id": content["id"],
                    "title": content.get("title", "Unknown"),
                    **result
                })

                if result["success"]:
                    processed += 1
                else:
                    failed += 1

            return {
                "success": True,
                "message": f"Processed {processed} items, {failed} failed",
                "processed": processed,
                "failed": failed,
                "results": results
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "processed": 0,
                "failed": 0,
                "results": []
            }

    async def get_pending_count(self, db, user_id: str) -> int:
        """Get count of pending content for a user."""
        try:
            response = await db.table("contents").select("id", count="exact").eq("user_id", user_id).eq("processing_status", "pending").execute()
            return response.count or 0
        except:
            return 0

    async def get_processing_stats(self, db, user_id: str) -> dict:
        """Get processing statistics for a user."""
        try:
            pending = await db.table("contents").select("id", count="exact").eq("user_id", user_id).eq("processing_status", "pending").execute()
            processing = await db.table("contents").select("id", count="exact").eq("user_id", user_id).eq("processing_status", "processing").execute()
            completed = await db.table("contents").select("id", count="exact").eq("user_id", user_id).eq("processing_status", "completed").execute()
            failed = await db.table("contents").select("id", count="exact").eq("user_id", user_id).eq("processing_status", "failed").execute()

            return {
                "pending": pending.count or 0,
                "processing": processing.count or 0,
                "completed": completed.count or 0,
                "failed": failed.count or 0
            }
        except Exception as e:
            return {
                "pending": 0,
                "processing": 0,
                "completed": 0,
                "failed": 0,
                "error": str(e)
            }


# Singleton instance
processor_service = ProcessorService()
