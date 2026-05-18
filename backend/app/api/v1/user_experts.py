"""
User Experts (Gurus) API endpoints.
Manages personal experts/gurus marked by the user for specific categories.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.api.deps import Database, CurrentUser

router = APIRouter()


async def get_expert_content_categories(db, user_id: str, person_name: str) -> list[str]:
    """
    AI entity extraction was removed (CHANGELOG 2026-05-18). Categories now
    have to come either from the expert's expert_categories field (manually
    set by the user) or from user_category on contents linked manually.
    This helper now just returns an empty list — the manually configured
    expert_categories on the row is authoritative.
    """
    return []


class ExpertCreate(BaseModel):
    person_name: str
    expert_categories: List[str] = []
    description: Optional[str] = None
    notes: Optional[str] = None
    avatar_url: Optional[str] = None


class ExpertUpdate(BaseModel):
    person_name: Optional[str] = None
    expert_categories: Optional[List[str]] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None


class ExpertResponse(BaseModel):
    id: str
    person_name: str
    expert_categories: List[str]
    description: Optional[str]
    notes: Optional[str]
    avatar_url: Optional[str]
    is_active: bool
    is_favorite: bool
    created_at: str
    updated_at: str


class ExpertWithStats(ExpertResponse):
    content_count: int = 0


@router.get("/")
async def list_experts(
    current_user: CurrentUser,
    db: Database,
    include_inactive: bool = False,
    category: Optional[str] = None,
):
    """List all experts for the current user."""
    query = db.table("user_experts").select("*").eq("user_id", current_user["id"])

    if not include_inactive:
        query = query.eq("is_active", True)

    result = await query.order("person_name").execute()
    experts = result.data or []

    # AI entity-based content count removed; categories come from the stored
    # expert_categories field directly (no derivation).
    for expert in experts:
        expert.setdefault("expert_categories", expert.get("expert_categories") or [])
        expert["content_count"] = 0

    # Filter by category if provided (now using calculated categories)
    if category:
        experts = [e for e in experts if category in e.get("expert_categories", [])]

    return {
        "experts": experts,
        "total": len(experts)
    }


@router.get("/categories")
async def get_all_expert_categories(
    current_user: CurrentUser,
    db: Database,
):
    """Union of expert_categories fields across all active experts."""
    experts_result = await db.table("user_experts").select("expert_categories").eq(
        "user_id", current_user["id"]
    ).eq("is_active", True).execute()

    all_categories = set()
    for expert in (experts_result.data or []):
        for cat in (expert.get("expert_categories") or []):
            if cat:
                all_categories.add(cat)

    return {"categories": sorted(list(all_categories))}


@router.get("/persons")
async def get_available_persons(
    current_user: CurrentUser,
    db: Database,
    query: Optional[str] = None,
    limit: int = 50,
):
    """
    Person autocomplete was derived from AI-extracted entities, which were
    removed (CHANGELOG 2026-05-18). Returns an empty list; users add
    experts by typing the name directly now.
    """
    return {"persons": [], "total": 0}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_expert(
    data: ExpertCreate,
    current_user: CurrentUser,
    db: Database,
):
    """Create a new expert."""
    # Check if expert already exists
    existing = await db.table("user_experts").select("*").eq(
        "user_id", current_user["id"]
    ).eq("person_name", data.person_name).execute()

    if existing.data:
        expert = existing.data[0]
        if not expert["is_active"]:
            # Reactivate
            result = await db.table("user_experts").update({
                "is_active": True,
                "expert_categories": data.expert_categories,
                "description": data.description,
                "notes": data.notes,
                "avatar_url": data.avatar_url,
            }).eq("id", expert["id"]).execute()
            return result.data[0]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este experto ya existe"
        )

    # Create new expert
    result = await db.table("user_experts").insert({
        "user_id": current_user["id"],
        "person_name": data.person_name,
        "expert_categories": data.expert_categories,
        "description": data.description,
        "notes": data.notes,
        "avatar_url": data.avatar_url,
        "is_active": True,
        "is_favorite": False,
    }).execute()

    return result.data[0]


@router.get("/{expert_id}")
async def get_expert(
    expert_id: str,
    current_user: CurrentUser,
    db: Database,
    preview_limit: int = 5,
):
    """Get a specific expert with their associated contents (preview)."""
    # Get the expert
    expert_result = await db.table("user_experts").select("*").eq(
        "id", expert_id
    ).eq("user_id", current_user["id"]).execute()

    if not expert_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experto no encontrado"
        )

    expert = expert_result.data[0]
    # AI entities removed — no auto-derived content list anymore.
    return {
        "expert": expert,
        "contents": [],
        "content_count": 0,
        "has_more": False,
        "preview_limit": preview_limit,
    }


@router.put("/{expert_id}")
async def update_expert(
    expert_id: str,
    data: ExpertUpdate,
    current_user: CurrentUser,
    db: Database,
):
    """Update an expert."""
    # Check ownership
    existing = await db.table("user_experts").select("id").eq(
        "id", expert_id
    ).eq("user_id", current_user["id"]).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experto no encontrado"
        )

    # Build update data
    update_data = {}
    if data.person_name is not None:
        update_data["person_name"] = data.person_name
    if data.expert_categories is not None:
        update_data["expert_categories"] = data.expert_categories
    if data.description is not None:
        update_data["description"] = data.description
    if data.notes is not None:
        update_data["notes"] = data.notes
    if data.avatar_url is not None:
        update_data["avatar_url"] = data.avatar_url
    if data.is_active is not None:
        update_data["is_active"] = data.is_active

    if not update_data:
        return existing.data[0]

    result = await db.table("user_experts").update(update_data).eq("id", expert_id).execute()
    return result.data[0]


@router.post("/{expert_id}/favorite")
async def toggle_expert_favorite(
    expert_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Toggle favorite status for an expert."""
    existing = await db.table("user_experts").select("id, is_favorite").eq(
        "id", expert_id
    ).eq("user_id", current_user["id"]).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experto no encontrado"
        )

    current_favorite = existing.data[0].get("is_favorite", False)
    new_favorite = not current_favorite

    await db.table("user_experts").update({"is_favorite": new_favorite}).eq("id", expert_id).execute()

    return {"success": True, "is_favorite": new_favorite}


@router.delete("/{expert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expert(
    expert_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Delete (deactivate) an expert."""
    existing = await db.table("user_experts").select("id").eq(
        "id", expert_id
    ).eq("user_id", current_user["id"]).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experto no encontrado"
        )

    # Soft delete
    await db.table("user_experts").update({"is_active": False}).eq("id", expert_id).execute()


@router.post("/{expert_id}/add-category")
async def add_category_to_expert(
    expert_id: str,
    category: str,
    current_user: CurrentUser,
    db: Database,
):
    """Add a category to an expert's expertise areas."""
    existing = await db.table("user_experts").select("id, expert_categories").eq(
        "id", expert_id
    ).eq("user_id", current_user["id"]).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experto no encontrado"
        )

    current_categories = existing.data[0].get("expert_categories") or []
    if category not in current_categories:
        current_categories.append(category)
        await db.table("user_experts").update({
            "expert_categories": current_categories
        }).eq("id", expert_id).execute()

    return {"success": True, "expert_categories": current_categories}


@router.post("/{expert_id}/remove-category")
async def remove_category_from_expert(
    expert_id: str,
    category: str,
    current_user: CurrentUser,
    db: Database,
):
    """Remove a category from an expert's expertise areas."""
    existing = await db.table("user_experts").select("id, expert_categories").eq(
        "id", expert_id
    ).eq("user_id", current_user["id"]).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experto no encontrado"
        )

    current_categories = existing.data[0].get("expert_categories") or []
    if category in current_categories:
        current_categories.remove(category)
        await db.table("user_experts").update({
            "expert_categories": current_categories
        }).eq("id", expert_id).execute()

    return {"success": True, "expert_categories": current_categories}
