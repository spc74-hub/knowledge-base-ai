"""
Taxonomy Tags API endpoints.
Manages tag inheritance rules based on taxonomy (categories, entities, concepts).
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.api.deps import Database, CurrentUser

router = APIRouter()


class TaxonomyTagCreate(BaseModel):
    taxonomy_type: str  # 'category', 'person', 'organization', 'product', 'concept'
    taxonomy_value: str  # e.g., "Elon Musk", "Technology & Computing"
    tag: str  # e.g., "Gurú", "Importante"
    color: Optional[str] = "#6366f1"


class TaxonomyTagUpdate(BaseModel):
    tag: Optional[str] = None
    color: Optional[str] = None


class TaxonomyTagResponse(BaseModel):
    id: str
    taxonomy_type: str
    taxonomy_value: str
    tag: str
    color: str
    created_at: str


class TaxonomyTagsListResponse(BaseModel):
    tags: List[TaxonomyTagResponse]
    total: int


@router.get("/", response_model=TaxonomyTagsListResponse)
async def list_taxonomy_tags(
    current_user: CurrentUser,
    db: Database,
    taxonomy_type: Optional[str] = None,
    taxonomy_value: Optional[str] = None,
):
    """List all taxonomy tag rules for the current user."""
    query = db.table("taxonomy_tags").select("*").eq("user_id", current_user["id"])

    if taxonomy_type:
        query = query.eq("taxonomy_type", taxonomy_type)
    if taxonomy_value:
        query = query.eq("taxonomy_value", taxonomy_value)

    result = query.order("created_at", desc=True).execute()

    tags = []
    for row in result.data:
        tags.append(TaxonomyTagResponse(
            id=row["id"],
            taxonomy_type=row["taxonomy_type"],
            taxonomy_value=row["taxonomy_value"],
            tag=row["tag"],
            color=row.get("color", "#6366f1"),
            created_at=str(row["created_at"]),
        ))

    return TaxonomyTagsListResponse(tags=tags, total=len(tags))


@router.post("/", response_model=TaxonomyTagResponse, status_code=status.HTTP_201_CREATED)
async def create_taxonomy_tag(
    data: TaxonomyTagCreate,
    current_user: CurrentUser,
    db: Database,
):
    """Create a new taxonomy tag rule."""
    # Validate taxonomy_type
    valid_types = ["category", "person", "organization", "product", "concept"]
    if data.taxonomy_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid taxonomy_type. Must be one of: {', '.join(valid_types)}"
        )

    # Check if already exists
    existing = db.table("taxonomy_tags").select("id").eq(
        "user_id", current_user["id"]
    ).eq(
        "taxonomy_type", data.taxonomy_type
    ).eq(
        "taxonomy_value", data.taxonomy_value
    ).eq(
        "tag", data.tag
    ).execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This tag rule already exists"
        )

    # Create the tag rule
    result = db.table("taxonomy_tags").insert({
        "user_id": current_user["id"],
        "taxonomy_type": data.taxonomy_type,
        "taxonomy_value": data.taxonomy_value,
        "tag": data.tag,
        "color": data.color or "#6366f1",
    }).execute()

    row = result.data[0]
    return TaxonomyTagResponse(
        id=row["id"],
        taxonomy_type=row["taxonomy_type"],
        taxonomy_value=row["taxonomy_value"],
        tag=row["tag"],
        color=row.get("color", "#6366f1"),
        created_at=str(row["created_at"]),
    )


@router.put("/{tag_id}", response_model=TaxonomyTagResponse)
async def update_taxonomy_tag(
    tag_id: str,
    data: TaxonomyTagUpdate,
    current_user: CurrentUser,
    db: Database,
):
    """Update a taxonomy tag rule."""
    # Check ownership
    existing = db.table("taxonomy_tags").select("*").eq(
        "id", tag_id
    ).eq(
        "user_id", current_user["id"]
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag rule not found"
        )

    # Build update data
    update_data = {}
    if data.tag is not None:
        update_data["tag"] = data.tag
    if data.color is not None:
        update_data["color"] = data.color

    if not update_data:
        return TaxonomyTagResponse(
            id=existing.data[0]["id"],
            taxonomy_type=existing.data[0]["taxonomy_type"],
            taxonomy_value=existing.data[0]["taxonomy_value"],
            tag=existing.data[0]["tag"],
            color=existing.data[0].get("color", "#6366f1"),
            created_at=str(existing.data[0]["created_at"]),
        )

    result = db.table("taxonomy_tags").update(update_data).eq("id", tag_id).execute()
    row = result.data[0]

    return TaxonomyTagResponse(
        id=row["id"],
        taxonomy_type=row["taxonomy_type"],
        taxonomy_value=row["taxonomy_value"],
        tag=row["tag"],
        color=row.get("color", "#6366f1"),
        created_at=str(row["created_at"]),
    )


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_taxonomy_tag(
    tag_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Delete a taxonomy tag rule."""
    # Check ownership
    existing = db.table("taxonomy_tags").select("id").eq(
        "id", tag_id
    ).eq(
        "user_id", current_user["id"]
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag rule not found"
        )

    db.table("taxonomy_tags").delete().eq("id", tag_id).execute()


@router.get("/inherited/{content_id}")
async def get_inherited_tags_for_content(
    content_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Get all inherited tags for a specific content based on its taxonomy."""
    # Get content
    content_result = db.table("contents").select(
        "iab_tier1, iab_tier2, iab_tier3, concepts, entities"
    ).eq("id", content_id).eq("user_id", current_user["id"]).execute()

    if not content_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found"
        )

    content = content_result.data[0]
    inherited_tags = []
    tag_sources = []  # Track where each tag comes from

    # Get all taxonomy tags for this user
    tags_result = db.table("taxonomy_tags").select("*").eq("user_id", current_user["id"]).execute()
    taxonomy_tags = tags_result.data

    for tt in taxonomy_tags:
        matched = False

        # Check category matches
        if tt["taxonomy_type"] == "category":
            if content.get("iab_tier1") == tt["taxonomy_value"]:
                matched = True
            elif content.get("iab_tier2") == tt["taxonomy_value"]:
                matched = True
            elif content.get("iab_tier3") == tt["taxonomy_value"]:
                matched = True

        # Check concept matches
        elif tt["taxonomy_type"] == "concept":
            concepts = content.get("concepts") or []
            if tt["taxonomy_value"] in concepts:
                matched = True

        # Check entity matches
        elif tt["taxonomy_type"] in ["person", "organization", "product"]:
            entities = content.get("entities") or {}
            entity_key = tt["taxonomy_type"] + "s"  # person -> persons
            entity_list = entities.get(entity_key) or []
            for entity in entity_list:
                if entity.get("name") == tt["taxonomy_value"]:
                    matched = True
                    break

        if matched:
            if tt["tag"] not in inherited_tags:
                inherited_tags.append(tt["tag"])
                tag_sources.append({
                    "tag": tt["tag"],
                    "from_type": tt["taxonomy_type"],
                    "from_value": tt["taxonomy_value"],
                    "color": tt.get("color", "#6366f1"),
                })

    return {
        "content_id": content_id,
        "inherited_tags": inherited_tags,
        "tag_sources": tag_sources,
    }


@router.get("/available")
async def get_available_tags(
    current_user: CurrentUser,
    db: Database,
):
    """Get all available tags: user_tags + taxonomy_tags (inherited)."""
    # 1. Get unique user_tags from all contents
    contents_result = db.table("contents").select("user_tags").eq("user_id", current_user["id"]).execute()
    user_tags = set()
    for c in contents_result.data:
        for tag in (c.get("user_tags") or []):
            if tag:
                user_tags.add(tag)

    # 2. Get taxonomy_tags (rules for inherited tags)
    taxonomy_result = db.table("taxonomy_tags").select("tag, color").eq("user_id", current_user["id"]).execute()
    inherited_tags_dict = {}
    for t in taxonomy_result.data:
        tag_name = t.get("tag")
        if tag_name and tag_name not in inherited_tags_dict:
            inherited_tags_dict[tag_name] = t.get("color", "#6366f1")

    return {
        "user_tags": sorted(list(user_tags)),
        "inherited_tags": [{"tag": k, "color": v} for k, v in sorted(inherited_tags_dict.items())],
    }


@router.get("/values/{taxonomy_type}")
async def get_taxonomy_values(
    taxonomy_type: str,
    current_user: CurrentUser,
    db: Database,
    search: Optional[str] = None,
):
    """Get available values for a taxonomy type from user's contents."""
    valid_types = ["category", "person", "organization", "product", "concept"]
    if taxonomy_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid taxonomy_type. Must be one of: {', '.join(valid_types)}"
        )

    values = set()

    if taxonomy_type == "category":
        # Get unique IAB categories
        result = db.table("contents").select(
            "iab_tier1, iab_tier2, iab_tier3"
        ).eq("user_id", current_user["id"]).execute()

        for row in result.data:
            if row.get("iab_tier1"):
                values.add(row["iab_tier1"])
            if row.get("iab_tier2"):
                values.add(row["iab_tier2"])
            if row.get("iab_tier3"):
                values.add(row["iab_tier3"])

    elif taxonomy_type == "concept":
        # Get unique concepts
        result = db.table("contents").select("concepts").eq("user_id", current_user["id"]).execute()
        for row in result.data:
            concepts = row.get("concepts") or []
            for c in concepts:
                values.add(c)

    else:
        # Get entities (person, organization, product)
        entity_key = taxonomy_type + "s"  # person -> persons
        result = db.table("contents").select("entities").eq("user_id", current_user["id"]).execute()
        for row in result.data:
            entities = row.get("entities") or {}
            entity_list = entities.get(entity_key) or []
            for entity in entity_list:
                if entity.get("name"):
                    values.add(entity["name"])

    # Filter by search term if provided
    if search:
        search_lower = search.lower()
        values = {v for v in values if search_lower in v.lower()}

    # Sort values
    sorted_values = sorted(values)

    return {
        "taxonomy_type": taxonomy_type,
        "values": sorted_values,
        "total": len(sorted_values),
    }
