"""
Captures API — the inbox of items received from ContentHub bridge.

Concepts:
  - "capture" = a row in contents that came from ContentHub (or any other
    external bridge) and is waiting for the user to decide where it lives
    in the PARA hierarchy.
  - "untriaged" = is_triaged = false. The active inbox.
  - "triaged" = is_triaged = true. Confirmed by the user (or auto-marked
    on creation because it had pre-assignment from the bridge).

Routes:
  GET  /api/v1/captures/inbox
  POST /api/v1/captures/{id}/triage
  GET  /api/v1/captures/inbox/count   (lightweight for the sidebar badge)
"""
from typing import List, Optional
import logging

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()


SELECT_FIELDS = (
    "id, url, type, title, summary, user_tags, user_note, "
    "is_favorite, is_archived, is_triaged, "
    "source_metadata, metadata, "
    "area_id, project_id, folder_id, "
    "view_count, created_at, fetched_at"
)


# ---------------------------------------------------------------------------
# GET /inbox  — list captures
# ---------------------------------------------------------------------------
@router.get("/inbox")
async def list_inbox(
    current_user: CurrentUser,
    db: Database,
    status_filter: str = Query("untriaged", pattern="^(untriaged|triaged|all)$", alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """
    Inbox of captures.

    `status`:
      - untriaged (default) — needs the user's attention
      - triaged  — already placed in PARA
      - all      — both
    """
    query = (
        db.table("contents")
        .select(SELECT_FIELDS, count="exact")
        .eq("user_id", current_user["id"])
        .neq("is_archived", True)
        # Captures come from external bridges, never journals or apple-notes
        .neq("type", "note")
    )

    if status_filter == "untriaged":
        query = query.eq("is_triaged", False)
    elif status_filter == "triaged":
        query = query.eq("is_triaged", True)

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    response = await query.execute()

    return {
        "data": response.data or [],
        "meta": {
            "total": response.count or 0,
            "offset": offset,
            "limit": limit,
            "status": status_filter,
        },
    }


# ---------------------------------------------------------------------------
# GET /inbox/count — lightweight count for the sidebar badge
# ---------------------------------------------------------------------------
@router.get("/inbox/count")
async def inbox_count(
    current_user: CurrentUser,
    db: Database,
):
    """Just the count of untriaged captures, for the nav badge."""
    response = await (
        db.table("contents")
        .select("id", count="exact")
        .eq("user_id", current_user["id"])
        .neq("is_archived", True)
        .neq("type", "note")
        .eq("is_triaged", False)
        .execute()
    )
    return {"untriaged": response.count or 0}


# ---------------------------------------------------------------------------
# POST /{id}/triage — confirm placement
# ---------------------------------------------------------------------------
class TriageRequest(BaseModel):
    area_id: Optional[str] = None
    project_id: Optional[str] = None
    objective_ids: Optional[List[str]] = None
    mental_model_ids: Optional[List[str]] = None
    user_note: Optional[str] = None
    user_tags: Optional[List[str]] = None


@router.post("/{content_id}/triage")
async def triage_capture(
    content_id: str,
    data: TriageRequest,
    current_user: CurrentUser,
    db: Database,
):
    """
    Confirm a capture's placement. Marks it as triaged and optionally
    persists assignments to area/project/objectives/mental_models and
    user_note/user_tags in a single call.
    """
    user_id = current_user["id"]

    # Ownership check
    existing = await (
        db.table("contents")
        .select("id, is_triaged")
        .eq("id", content_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capture not found")

    # Build update payload
    update: dict = {"is_triaged": True}
    if data.area_id is not None:
        update["area_id"] = data.area_id
    if data.project_id is not None:
        update["project_id"] = data.project_id
    if data.user_note is not None:
        update["user_note"] = data.user_note
    if data.user_tags is not None:
        update["user_tags"] = data.user_tags

    await db.table("contents").update(update).eq("id", content_id).execute()

    # Junctions: objectives
    if data.objective_ids:
        for oid in data.objective_ids:
            # idempotent insert via "is it there yet?" check (no UPSERT in CompatDB)
            existing_link = await (
                db.table("objective_contents")
                .select("id")
                .eq("objective_id", oid)
                .eq("content_id", content_id)
                .execute()
            )
            if not existing_link.data:
                await db.table("objective_contents").insert({
                    "objective_id": oid,
                    "content_id": content_id,
                    "user_id": user_id,
                }).execute()

    # Junctions: mental models
    if data.mental_model_ids:
        for mid in data.mental_model_ids:
            existing_link = await (
                db.table("content_mental_models")
                .select("id")
                .eq("content_id", content_id)
                .eq("mental_model_id", mid)
                .execute()
            )
            if not existing_link.data:
                await db.table("content_mental_models").insert({
                    "content_id": content_id,
                    "mental_model_id": mid,
                    "user_id": user_id,
                }).execute()

    # Return the fresh row
    fresh = await (
        db.table("contents")
        .select(SELECT_FIELDS)
        .eq("id", content_id)
        .execute()
    )
    return {"success": True, "content": fresh.data[0] if fresh.data else None}


# ---------------------------------------------------------------------------
# POST /{id}/untriage — push it back to the inbox (escape hatch)
# ---------------------------------------------------------------------------
@router.post("/{content_id}/untriage")
async def untriage_capture(
    content_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Flip is_triaged back to false. Doesn't unlink PARA — only resets the flag."""
    existing = await (
        db.table("contents")
        .select("id")
        .eq("id", content_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capture not found")

    await db.table("contents").update({"is_triaged": False}).eq("id", content_id).execute()
    return {"success": True}
