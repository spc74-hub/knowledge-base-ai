"""
Taxonomy Explorer API endpoints.
Provides hierarchical exploration of content by categories, entities, and concepts.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser

router = APIRouter()


class TaxonomyNode(BaseModel):
    """A node in the taxonomy tree."""
    id: str
    label: str
    count: int
    type: str  # 'category', 'person', 'organization', 'product', 'concept', 'content'


class TaxonomyRequest(BaseModel):
    """Request for taxonomy data."""
    root_type: str = "category"  # category, person, organization, product, concept
    type_filter: Optional[str] = None  # DEPRECATED: Single filter (kept for backwards compatibility)
    type_filters: Optional[List[str]] = None  # Filter by multiple content types
    parent_type: Optional[str] = None  # Type of parent node when drilling down
    parent_value: Optional[str] = None  # Value of parent node when drilling down


class TaxonomyResponse(BaseModel):
    """Response with taxonomy nodes."""
    nodes: List[TaxonomyNode]
    path: List[dict]  # Breadcrumb path
    total_contents: int


class ContentListRequest(BaseModel):
    """Request for content list at leaf level."""
    filters: dict  # All accumulated filters from drill-down
    type_filter: Optional[str] = None  # DEPRECATED: Single filter (kept for backwards compatibility)
    type_filters: Optional[List[str]] = None  # Filter by multiple content types
    limit: int = 10000
    offset: int = 0


@router.post("/nodes", response_model=TaxonomyResponse)
async def get_taxonomy_nodes(
    data: TaxonomyRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Get taxonomy nodes for the explorer.
    Returns aggregated counts for the selected dimension.
    """
    try:
        user_id = current_user["id"]

        # Build base query
        query = db.table("contents").select(
            "id, title, type, iab_tier1, concepts, entities, metadata"
        ).eq("user_id", user_id).eq("is_archived", False)

        # Determine which type filters to use (support both old and new format)
        active_type_filters = data.type_filters or ([data.type_filter] if data.type_filter else None)

        # We'll filter by type in Python since Supabase doesn't support complex OR conditions easily
        # For now, get all data and filter after

        # Apply parent filter if drilling down
        if data.parent_type and data.parent_value:
            if data.parent_type == "category":
                query = query.eq("iab_tier1", data.parent_value)
            elif data.parent_type == "concept":
                query = query.contains("concepts", [data.parent_value])
            elif data.parent_type in ["person", "organization", "product"]:
                # Entity filter - need to check in entities JSONB
                entity_key = f"{data.parent_type}s"  # persons, organizations, products
                # Use filter for JSONB contains
                import json
                pattern = json.dumps([{"name": data.parent_value}])
                query = query.filter(f"entities->{entity_key}", "cs", pattern)

        response = query.execute()
        items = response.data or []

        # Filter by type if specified (supports multiple types)
        if active_type_filters:
            def matches_type_filter(item, type_filters):
                item_type = item.get("type")
                metadata = item.get("metadata") or {}
                # Check for apple_notes special case
                if item_type == "note" and metadata.get("source") == "apple_notes":
                    effective_type = "apple_notes"
                else:
                    effective_type = item_type
                return effective_type in type_filters

            items = [item for item in items if matches_type_filter(item, active_type_filters)]

        # Aggregate based on root_type
        nodes = []
        aggregation = {}

        for item in items:
            if data.root_type == "category":
                key = item.get("iab_tier1") or "Sin categoria"
                if key not in aggregation:
                    aggregation[key] = {"count": 0, "label": key}
                aggregation[key]["count"] += 1

            elif data.root_type == "concept":
                for concept in item.get("concepts") or []:
                    if concept not in aggregation:
                        aggregation[concept] = {"count": 0, "label": concept}
                    aggregation[concept]["count"] += 1

            elif data.root_type in ["person", "organization", "product"]:
                entity_key = f"{data.root_type}s"
                entities = item.get("entities") or {}
                entity_list = entities.get(entity_key) or []
                for entity in entity_list:
                    name = entity.get("name") if isinstance(entity, dict) else entity
                    if name:
                        if name not in aggregation:
                            aggregation[name] = {"count": 0, "label": name}
                        aggregation[name]["count"] += 1

        # Convert to nodes, sorted by count
        for key, value in aggregation.items():
            nodes.append(TaxonomyNode(
                id=f"{data.root_type}:{key}",
                label=value["label"],
                count=value["count"],
                type=data.root_type
            ))

        nodes.sort(key=lambda x: x.count, reverse=True)

        # Build breadcrumb path
        path = []
        if data.parent_type and data.parent_value:
            path.append({
                "type": data.parent_type,
                "value": data.parent_value,
                "label": data.parent_value
            })

        return TaxonomyResponse(
            nodes=nodes,
            path=path,
            total_contents=len(items)
        )

    except Exception as e:
        import traceback
        print(f"Taxonomy error: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/contents")
async def get_taxonomy_contents(
    data: ContentListRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Get contents matching the accumulated filters from drill-down.
    """
    try:
        user_id = current_user["id"]

        # Build query with all filters
        query = db.table("contents").select(
            "id, title, type, url, iab_tier1, summary, created_at, metadata"
        ).eq("user_id", user_id).eq("is_archived", False)

        # Determine which type filters to use (support both old and new format)
        active_type_filters = data.type_filters or ([data.type_filter] if data.type_filter else None)

        # Apply accumulated filters
        filters = data.filters

        if filters.get("category"):
            query = query.eq("iab_tier1", filters["category"])

        if filters.get("concept"):
            query = query.contains("concepts", [filters["concept"]])

        for entity_type in ["person", "organization", "product"]:
            if filters.get(entity_type):
                import json
                entity_key = f"{entity_type}s"
                pattern = json.dumps([{"name": filters[entity_type]}])
                query = query.filter(f"entities->{entity_key}", "cs", pattern)

        # Execute query (without pagination first if we need to filter by type)
        if active_type_filters:
            # Get all results first, then filter and paginate in Python
            response = query.order("created_at", desc=True).execute()
            all_items = response.data or []

            # Filter by type
            def matches_type_filter(item, type_filters):
                item_type = item.get("type")
                metadata = item.get("metadata") or {}
                if item_type == "note" and metadata.get("source") == "apple_notes":
                    effective_type = "apple_notes"
                else:
                    effective_type = item_type
                return effective_type in type_filters

            filtered_items = [item for item in all_items if matches_type_filter(item, active_type_filters)]

            # Apply pagination
            paginated_items = filtered_items[data.offset:data.offset + data.limit]

            return {
                "contents": paginated_items,
                "total": len(filtered_items),
                "offset": data.offset,
                "limit": data.limit
            }
        else:
            # No type filter, use DB pagination
            response = query.order("created_at", desc=True).range(
                data.offset, data.offset + data.limit - 1
            ).execute()

            return {
                "contents": response.data or [],
                "total": len(response.data or []),
                "offset": data.offset,
                "limit": data.limit
            }

    except Exception as e:
        import traceback
        print(f"Taxonomy contents error: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/types")
async def get_content_types(
    current_user: CurrentUser,
    db: Database
):
    """
    Get available content types for filtering.
    """
    try:
        user_id = current_user["id"]

        response = db.table("contents").select(
            "type, metadata"
        ).eq("user_id", user_id).eq("is_archived", False).execute()

        type_counts = {}
        for item in response.data or []:
            t = item.get("type")
            if t == "note":
                metadata = item.get("metadata") or {}
                if metadata.get("source") == "apple_notes":
                    t = "apple_notes"
            if t:
                type_counts[t] = type_counts.get(t, 0) + 1

        types = [
            {"value": k, "label": _get_type_label(k), "count": v}
            for k, v in type_counts.items()
        ]
        types.sort(key=lambda x: x["count"], reverse=True)

        return {"types": types}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def _get_type_label(type_value: str) -> str:
    """Get human-readable label for content type."""
    labels = {
        "article": "Articulos",
        "video": "Videos",
        "note": "Notas",
        "apple_notes": "Apple Notes",
        "pdf": "PDFs",
        "tweet": "Tweets",
        "thread": "Threads",
    }
    return labels.get(type_value, type_value.capitalize())
