"""
Podcast capture API endpoint.
Allows capturing podcast episodes with transcripts via iOS Shortcut.
"""
import re
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser
from app.services.classifier import classifier_service
from app.services.summarizer import summarizer_service
from app.services.embeddings import embeddings_service
from app.services.usage_tracker import usage_tracker

router = APIRouter()
logger = logging.getLogger(__name__)


class PodcastCaptureRequest(BaseModel):
    """Request model for podcast capture."""
    podcast_url: str  # URL from Apple Podcasts share
    transcript: str  # Pasted transcript text
    episode_title: Optional[str] = None  # Optional override
    podcast_name: Optional[str] = None  # Optional override
    process_now: bool = True  # Process with AI immediately


class PodcastCaptureResponse(BaseModel):
    """Response model for podcast capture."""
    success: bool
    message: str
    content_id: Optional[str] = None
    title: Optional[str] = None
    podcast_name: Optional[str] = None
    error: Optional[str] = None


async def fetch_podcast_metadata(url: str) -> dict:
    """
    Fetch metadata from Apple Podcasts URL.
    Uses iTunes Search API to get episode details.
    """
    import httpx

    metadata = {
        "podcast_name": None,
        "episode_title": None,
        "artwork_url": None,
        "duration_ms": None,
        "release_date": None,
        "description": None,
    }

    try:
        # Extract podcast and episode IDs from URL
        # Format: https://podcasts.apple.com/es/podcast/PODCAST-NAME/id123456789?i=1000123456789
        podcast_id_match = re.search(r'/id(\d+)', url)
        episode_id_match = re.search(r'[?&]i=(\d+)', url)

        if not podcast_id_match:
            logger.warning(f"Could not extract podcast ID from URL: {url}")
            return metadata

        podcast_id = podcast_id_match.group(1)
        episode_id = episode_id_match.group(1) if episode_id_match else None

        async with httpx.AsyncClient(timeout=10.0) as client:
            if episode_id:
                # Try to get specific episode
                response = await client.get(
                    f"https://itunes.apple.com/lookup",
                    params={"id": episode_id, "entity": "podcastEpisode"}
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("resultCount", 0) > 0:
                        result = data["results"][0]
                        metadata["episode_title"] = result.get("trackName")
                        metadata["podcast_name"] = result.get("collectionName")
                        metadata["artwork_url"] = result.get("artworkUrl600") or result.get("artworkUrl100")
                        metadata["duration_ms"] = result.get("trackTimeMillis")
                        metadata["release_date"] = result.get("releaseDate")
                        metadata["description"] = result.get("description")
                        return metadata

            # Fallback: get podcast info
            response = await client.get(
                f"https://itunes.apple.com/lookup",
                params={"id": podcast_id}
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("resultCount", 0) > 0:
                    result = data["results"][0]
                    metadata["podcast_name"] = result.get("collectionName")
                    metadata["artwork_url"] = result.get("artworkUrl600") or result.get("artworkUrl100")

    except Exception as e:
        logger.error(f"Error fetching podcast metadata: {e}")

    return metadata


@router.post("/capture", response_model=PodcastCaptureResponse)
async def capture_podcast(
    data: PodcastCaptureRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Capture a podcast episode with transcript.

    Flow:
    1. Receive URL + transcript from iOS Shortcut
    2. Fetch metadata from Apple Podcasts (title, podcast name, artwork)
    3. Save to database with type "podcast"
    4. Process with AI (summary, entities, concepts) if process_now=True
    """
    try:
        user_id = current_user["id"]
        url_str = str(data.podcast_url).strip()
        transcript = data.transcript.strip()

        if not transcript:
            return PodcastCaptureResponse(
                success=False,
                message="Transcript is required",
                error="missing_transcript"
            )

        if len(transcript) < 100:
            return PodcastCaptureResponse(
                success=False,
                message="Transcript is too short (min 100 characters)",
                error="transcript_too_short"
            )

        logger.info(f"Podcast capture request: {url_str[:50]}...")

        # Check if URL already exists
        existing = db.table("contents").select("id, title").eq(
            "user_id", user_id
        ).eq("url", url_str).execute()

        if existing.data:
            return PodcastCaptureResponse(
                success=False,
                message="This podcast episode is already saved",
                content_id=existing.data[0]["id"],
                title=existing.data[0]["title"],
                error="duplicate"
            )

        # Fetch metadata from Apple Podcasts
        metadata = await fetch_podcast_metadata(url_str)

        # Use provided overrides or fetched metadata
        episode_title = data.episode_title or metadata.get("episode_title") or "Podcast Episode"
        podcast_name = data.podcast_name or metadata.get("podcast_name") or "Unknown Podcast"

        # Build full title
        title = f"{episode_title}"
        if podcast_name and podcast_name != "Unknown Podcast":
            title = f"{podcast_name}: {episode_title}"

        # Calculate word count and reading time
        word_count = len(transcript.split())
        reading_time = max(1, word_count // 200)

        # Format duration if available
        duration_str = None
        if metadata.get("duration_ms"):
            duration_min = metadata["duration_ms"] // 60000
            duration_str = f"{duration_min} min"

        # Base content data
        content_data = {
            "user_id": user_id,
            "url": url_str,
            "type": "podcast",
            "title": title,
            "raw_content": transcript[:100000],  # Store full transcript
            "full_text": transcript[:100000],  # Also in full_text for search
            "reading_time_minutes": reading_time,
            "metadata": {
                "source": "apple_podcasts",
                "podcast_name": podcast_name,
                "episode_title": episode_title,
                "artwork_url": metadata.get("artwork_url"),
                "duration": duration_str,
                "duration_ms": metadata.get("duration_ms"),
                "release_date": metadata.get("release_date"),
                "word_count": word_count,
                "saved_via": "ios_shortcut_podcast"
            },
            "user_tags": [],
            "processing_status": "pending" if not data.process_now else "processing"
        }

        # Process with AI if requested
        if data.process_now:
            usage_tracker.set_db(db)

            try:
                # Classify content
                classification = await classifier_service.classify(
                    title=title,
                    content=transcript,
                    url=url_str,
                    user_id=user_id
                )

                # Generate summary
                summary = await summarizer_service.summarize(
                    title=title,
                    content=transcript,
                    language=classification.language,
                    user_id=user_id
                )

                # Generate embedding
                embedding_text = embeddings_service.prepare_content_for_embedding(
                    title=title,
                    summary=summary,
                    content=transcript,
                    concepts=classification.concepts,
                    entities=classification.entities.model_dump() if classification.entities else None,
                    metadata=content_data["metadata"]
                )
                embedding = await embeddings_service.generate_embedding(
                    embedding_text,
                    user_id=user_id,
                    operation="content_embedding"
                )

                # Add AI-processed fields
                content_data.update({
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
                    "content_format": "audio_transcript",
                    "embedding": embedding,
                    "processing_status": "completed"
                })

            except Exception as e:
                logger.error(f"AI processing failed: {e}")
                # Still save but mark as pending
                content_data["processing_status"] = "pending"
                content_data["metadata"]["ai_error"] = str(e)

        # Save to database
        response = db.table("contents").insert(content_data).execute()

        if not response.data:
            return PodcastCaptureResponse(
                success=False,
                message="Failed to save podcast",
                error="database_error"
            )

        status_msg = "saved and processed" if content_data["processing_status"] == "completed" else "saved (pending processing)"

        return PodcastCaptureResponse(
            success=True,
            message=f"Podcast {status_msg}!",
            content_id=response.data[0]["id"],
            title=title,
            podcast_name=podcast_name
        )

    except Exception as e:
        logger.error(f"Podcast capture error: {e}")
        import traceback
        traceback.print_exc()
        return PodcastCaptureResponse(
            success=False,
            message="An error occurred",
            error=str(e)
        )


@router.post("/capture-simple")
async def capture_podcast_simple(
    current_user: CurrentUser,
    db: Database,
    url: str = "",
    transcript: str = "",
    title: str = "",
    podcast: str = ""
):
    """
    Simplified endpoint for iOS Shortcut with query parameters.
    Easier to call from Shortcuts without JSON body.
    """
    request = PodcastCaptureRequest(
        podcast_url=url,
        transcript=transcript,
        episode_title=title if title else None,
        podcast_name=podcast if podcast else None,
        process_now=True
    )
    return await capture_podcast(request, current_user, db)
