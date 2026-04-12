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
    Get effective categories (user_category > iab_tier1) from contents
    where this person appears.
    """
    # Get contents from AI entities (entities.persons)
    ai_contents = await db.table("contents").select(
        "iab_tier1, user_category"
    ).eq(
        "user_id", user_id
    ).contains(
        "entities", {"persons": [person_name]}
    ).execute()

    # Get contents from user entities (user_entities.persons)
    user_contents = await db.table("contents").select(
        "iab_tier1, user_category"
    ).eq(
        "user_id", user_id
    ).contains(
        "user_entities", {"persons": [person_name]}
    ).execute()

    # Collect unique effective categories
    categories = set()
    for content in (ai_contents.data or []) + (user_contents.data or []):
        # Effective category: user_category takes priority over iab_tier1
        effective_cat = content.get("user_category") or content.get("iab_tier1")
        if effective_cat:
            categories.add(effective_cat)

    return sorted(list(categories))


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

    # Calculate categories and counts for each expert from their associated contents
    for expert in experts:
        person_name = expert["person_name"]

        # Get effective categories from contents (user_category > iab_tier1)
        expert["expert_categories"] = await get_expert_content_categories(
            db, current_user["id"], person_name
        )

        # Count from AI entities (entities.persons)
        ai_result = await db.table("contents").select(
            "id", count="exact"
        ).eq(
            "user_id", current_user["id"]
        ).contains(
            "entities", {"persons": [person_name]}
        ).execute()

        # Count from user entities (user_entities.persons)
        user_result = await db.table("contents").select(
            "id", count="exact"
        ).eq(
            "user_id", current_user["id"]
        ).contains(
            "user_entities", {"persons": [person_name]}
        ).execute()

        # Combine counts (note: some may overlap, but this gives a reasonable estimate)
        ai_count = ai_result.count or 0
        user_count = user_result.count or 0
        expert["content_count"] = max(ai_count, user_count) if ai_count > 0 or user_count > 0 else 0

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
    """
    Get all unique effective categories from contents associated with experts.
    Categories are derived from user_category (priority) or iab_tier1.
    """
    # Get all active experts
    experts_result = await db.table("user_experts").select("person_name").eq(
        "user_id", current_user["id"]
    ).eq("is_active", True).execute()

    all_categories = set()
    for expert in (experts_result.data or []):
        person_name = expert["person_name"]
        # Get effective categories for this expert
        categories = await get_expert_content_categories(db, current_user["id"], person_name)
        all_categories.update(categories)

    return {
        "categories": sorted(list(all_categories))
    }


@router.get("/persons")
async def get_available_persons(
    current_user: CurrentUser,
    db: Database,
    query: Optional[str] = None,
    limit: int = 50,
):
    """
    Get unique persons from content entities that can be marked as experts.
    This helps autocomplete when adding a new expert.
    """
    # Get all contents with entities.persons
    contents = await db.table("contents").select("entities").eq(
        "user_id", current_user["id"]
    ).not_.is_("entities", "null").execute()

    # Extract unique persons
    persons_set = set()
    for content in (contents.data or []):
        entities = content.get("entities") or {}
        persons = entities.get("persons") or []
        for person in persons:
            if isinstance(person, str):
                persons_set.add(person)

    # Filter by query if provided
    persons = list(persons_set)
    if query:
        query_lower = query.lower()
        persons = [p for p in persons if query_lower in p.lower()]

    # Sort and limit
    persons.sort()
    persons = persons[:limit]

    return {
        "persons": persons,
        "total": len(persons)
    }


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
    person_name = expert["person_name"]

    # Search both AI entities and user entities
    # Get contents from AI entities (entities.persons)
    # Include user_category to show effective category
    ai_contents = await db.table("contents").select(
        "id, title, url, type, summary, iab_tier1, user_category, created_at"
    ).eq(
        "user_id", current_user["id"]
    ).contains(
        "entities", {"persons": [person_name]}
    ).order("created_at", desc=True).limit(preview_limit + 10).execute()

    # Get contents from user entities (user_entities.persons)
    user_contents = await db.table("contents").select(
        "id, title, url, type, summary, iab_tier1, user_category, created_at"
    ).eq(
        "user_id", current_user["id"]
    ).contains(
        "user_entities", {"persons": [person_name]}
    ).order("created_at", desc=True).limit(preview_limit + 10).execute()

    # Merge and deduplicate results
    all_contents = {}
    for content in (ai_contents.data or []):
        all_contents[content["id"]] = content
    for content in (user_contents.data or []):
        all_contents[content["id"]] = content

    # Sort by created_at and limit to preview
    sorted_contents = sorted(
        all_contents.values(),
        key=lambda x: x["created_at"],
        reverse=True
    )[:preview_limit]

    # Get total counts for "Ver todos" indicator
    ai_count_result = await db.table("contents").select(
        "id", count="exact"
    ).eq(
        "user_id", current_user["id"]
    ).contains(
        "entities", {"persons": [person_name]}
    ).execute()

    user_count_result = await db.table("contents").select(
        "id", count="exact"
    ).eq(
        "user_id", current_user["id"]
    ).contains(
        "user_entities", {"persons": [person_name]}
    ).execute()

    # Estimate total (may have some overlap, but good enough)
    total_count = len(all_contents)
    # If we fetched more than preview_limit, there are more
    has_more = len(all_contents) > preview_limit

    # Calculate effective categories from contents (user_category > iab_tier1)
    expert["expert_categories"] = await get_expert_content_categories(
        db, current_user["id"], person_name
    )

    return {
        "expert": expert,
        "contents": sorted_contents,
        "content_count": total_count,
        "has_more": has_more,
        "preview_limit": preview_limit
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
