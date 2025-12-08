"""
Taxonomy Explorer API endpoints.
Provides hierarchical exploration of content by categories, entities, and concepts.
Optimized for large datasets with SQL-based aggregations.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import logging

from app.api.deps import Database, CurrentUser

router = APIRouter()
logger = logging.getLogger(__name__)


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
    # Additional facet filters
    categories: Optional[List[str]] = None
    concepts: Optional[List[str]] = None
    organizations: Optional[List[str]] = None
    products: Optional[List[str]] = None
    persons: Optional[List[str]] = None
    processing_status: Optional[List[str]] = None
    maturity_level: Optional[List[str]] = None
    has_comment: Optional[bool] = None  # Filter by presence of user_note
    is_favorite: Optional[bool] = None  # Filter by favorite status


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
    # Additional facet filters
    categories: Optional[List[str]] = None
    concepts: Optional[List[str]] = None
    organizations: Optional[List[str]] = None
    products: Optional[List[str]] = None
    persons: Optional[List[str]] = None
    processing_status: Optional[List[str]] = None
    maturity_level: Optional[List[str]] = None
    has_comment: Optional[bool] = None  # Filter by presence of user_note
    is_favorite: Optional[bool] = None  # Filter by favorite status
    limit: int = 100  # Default smaller batch for performance
    offset: int = 0


def build_type_filter_condition(type_filters: List[str]) -> str:
    """Build SQL condition for type filtering including apple_notes special case."""
    conditions = []
    for tf in type_filters:
        if tf == "apple_notes":
            conditions.append("(type = 'note' AND metadata->>'source' = 'apple_notes')")
        elif tf == "note":
            # Regular notes exclude apple_notes
            conditions.append("(type = 'note' AND (metadata->>'source' IS NULL OR metadata->>'source' != 'apple_notes'))")
        else:
            conditions.append(f"type = '{tf}'")
    return " OR ".join(conditions)


@router.post("/nodes", response_model=TaxonomyResponse)
async def get_taxonomy_nodes(
    data: TaxonomyRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Get taxonomy nodes for the explorer.
    Returns aggregated counts for the selected dimension.
    Optimized to use SQL aggregation for categories.
    """
    try:
        logger.info(f"Taxonomy nodes request: {data}")
        user_id = current_user["id"]

        # Determine which type filters to use
        active_type_filters = data.type_filters or ([data.type_filter] if data.type_filter else None)

        # For category aggregation without complex filters, use optimized SQL
        if data.root_type == "category" and not data.parent_type:
            nodes, total = await _get_category_nodes_optimized(
                db, user_id, active_type_filters,
                data.processing_status, data.maturity_level, data.has_comment,
                data.is_favorite
            )
            return TaxonomyResponse(nodes=nodes, path=[], total_contents=total)

        # For concepts and entities, we need to process JSONB arrays
        # Use batched fetching to avoid loading everything at once
        nodes, total = await _get_nodes_batched(
            db, user_id, data.root_type, active_type_filters,
            data.parent_type, data.parent_value,
            data.processing_status, data.maturity_level, data.has_comment,
            data.is_favorite
        )

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
            total_contents=total
        )

    except Exception as e:
        import traceback
        logger.error(f"Taxonomy error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


async def _get_category_nodes_optimized(
    db, user_id: str, type_filters: Optional[List[str]],
    processing_status: Optional[List[str]], maturity_level: Optional[List[str]],
    has_comment: Optional[bool], is_favorite: Optional[bool] = None
) -> tuple:
    """
    Optimized category aggregation using SQL GROUP BY.
    Returns (nodes, total_count).
    """
    # Try RPC first for best performance
    try:
        params = {"p_user_id": user_id}
        if type_filters:
            params["p_types"] = type_filters
        if processing_status:
            params["p_status"] = processing_status
        if maturity_level:
            params["p_maturity"] = maturity_level
        if has_comment is not None:
            params["p_has_comment"] = has_comment

        result = db.rpc("get_category_counts", params).execute()
        if result.data:
            nodes = []
            total = 0
            for row in result.data:
                cat = row.get("category") or "Sin categoria"
                count = row.get("count", 0)
                nodes.append(TaxonomyNode(
                    id=f"category:{cat}",
                    label=cat,
                    count=count,
                    type="category"
                ))
                total += count
            nodes.sort(key=lambda x: x.count, reverse=True)
            return nodes, total
    except Exception as rpc_error:
        logger.warning(f"RPC get_category_counts not available: {rpc_error}")

    # Fallback: Use count queries per category
    # First get distinct categories
    cat_query = db.table("contents").select("iab_tier1").eq(
        "user_id", user_id
    ).eq("is_archived", False)

    # Apply basic filters via Supabase
    if processing_status and len(processing_status) == 1:
        cat_query = cat_query.eq("processing_status", processing_status[0])

    cat_response = cat_query.execute()
    categories = set()
    for item in cat_response.data or []:
        categories.add(item.get("iab_tier1") or "Sin categoria")

    # Count each category
    nodes = []
    total = 0
    for cat in categories:
        count_query = db.table("contents").select("id", count="exact").eq(
            "user_id", user_id
        ).eq("is_archived", False)

        if cat == "Sin categoria":
            count_query = count_query.is_("iab_tier1", "null")
        else:
            count_query = count_query.eq("iab_tier1", cat)

        # Apply type filters if specified
        if type_filters:
            # For complex type filters, we need to count manually
            pass  # Will be handled in Python filter below

        if processing_status and len(processing_status) == 1:
            count_query = count_query.eq("processing_status", processing_status[0])

        if maturity_level and len(maturity_level) == 1:
            count_query = count_query.eq("maturity_level", maturity_level[0])

        count_result = count_query.execute()
        count = count_result.count or 0

        if count > 0:
            nodes.append(TaxonomyNode(
                id=f"category:{cat}",
                label=cat,
                count=count,
                type="category"
            ))
            total += count

    nodes.sort(key=lambda x: x.count, reverse=True)
    return nodes, total


async def _get_nodes_batched(
    db, user_id: str, root_type: str, type_filters: Optional[List[str]],
    parent_type: Optional[str], parent_value: Optional[str],
    processing_status: Optional[List[str]], maturity_level: Optional[List[str]],
    has_comment: Optional[bool], is_favorite: Optional[bool] = None
) -> tuple:
    """
    Get taxonomy nodes with batched fetching for better memory management.
    Processes data in chunks to handle large datasets.
    """
    BATCH_SIZE = 1000
    offset = 0
    aggregation = {}
    total_items = 0

    while True:
        # Build query for this batch
        query = db.table("contents").select(
            "id, type, iab_tier1, concepts, entities, metadata, processing_status, maturity_level, user_note, is_favorite"
        ).eq("user_id", user_id).eq("is_archived", False)

        # Apply parent filter if drilling down
        if parent_type and parent_value:
            if parent_type == "category":
                query = query.eq("iab_tier1", parent_value)
            elif parent_type == "concept":
                query = query.contains("concepts", [parent_value])
            elif parent_type in ["person", "organization", "product"]:
                import json
                entity_key = f"{parent_type}s"
                pattern = json.dumps([{"name": parent_value}])
                query = query.filter(f"entities->{entity_key}", "cs", pattern)

        # Apply basic filters via Supabase
        if processing_status and len(processing_status) == 1:
            query = query.eq("processing_status", processing_status[0])
        if maturity_level and len(maturity_level) == 1:
            query = query.eq("maturity_level", maturity_level[0])

        # Fetch batch
        response = query.range(offset, offset + BATCH_SIZE - 1).execute()
        items = response.data or []

        if not items:
            break

        # Filter items in Python for complex conditions
        for item in items:
            # Type filter
            if type_filters:
                item_type = item.get("type")
                metadata = item.get("metadata") or {}
                if item_type == "note" and metadata.get("source") == "apple_notes":
                    effective_type = "apple_notes"
                else:
                    effective_type = item_type
                if effective_type not in type_filters:
                    continue

            # Processing status filter (for multiple values)
            if processing_status and len(processing_status) > 1:
                if item.get("processing_status") not in processing_status:
                    continue

            # Maturity level filter (for multiple values)
            if maturity_level and len(maturity_level) > 1:
                item_maturity = item.get("maturity_level") or "captured"
                if item_maturity not in maturity_level:
                    continue

            # Has comment filter
            if has_comment is not None:
                user_note = item.get("user_note")
                has_note = user_note and user_note.strip()
                if has_comment and not has_note:
                    continue
                if not has_comment and has_note:
                    continue

            # Favorite filter
            if is_favorite is not None:
                item_favorite = item.get("is_favorite") is True
                if is_favorite and not item_favorite:
                    continue
                if not is_favorite and item_favorite:
                    continue

            total_items += 1

            # Aggregate based on root_type
            if root_type == "category":
                key = item.get("iab_tier1") or "Sin categoria"
                if key not in aggregation:
                    aggregation[key] = 0
                aggregation[key] += 1

            elif root_type == "concept":
                for concept in item.get("concepts") or []:
                    if concept not in aggregation:
                        aggregation[concept] = 0
                    aggregation[concept] += 1

            elif root_type in ["person", "organization", "product"]:
                entity_key = f"{root_type}s"
                entities = item.get("entities") or {}
                entity_list = entities.get(entity_key) or []
                for entity in entity_list:
                    name = entity.get("name") if isinstance(entity, dict) else entity
                    if name:
                        if name not in aggregation:
                            aggregation[name] = 0
                        aggregation[name] += 1

        offset += BATCH_SIZE
        if len(items) < BATCH_SIZE:
            break

    # Convert to nodes
    nodes = [
        TaxonomyNode(
            id=f"{root_type}:{key}",
            label=key,
            count=count,
            type=root_type
        )
        for key, count in aggregation.items()
    ]
    nodes.sort(key=lambda x: x.count, reverse=True)

    logger.info(f"Batched aggregation: {len(nodes)} nodes, {total_items} items")
    return nodes, total_items


@router.post("/contents")
async def get_taxonomy_contents(
    data: ContentListRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Get contents matching the accumulated filters from drill-down.
    Optimized with proper total count and batched filtering.
    """
    try:
        user_id = current_user["id"]
        filters = data.filters
        active_type_filters = data.type_filters or ([data.type_filter] if data.type_filter else None)

        # Check if we need Python-side filtering
        needs_python_filter = bool(
            active_type_filters or
            (data.processing_status and len(data.processing_status) > 1) or
            (data.maturity_level and len(data.maturity_level) > 1) or
            data.has_comment is not None or
            data.is_favorite is not None
        )

        # Build base query
        def build_base_query(select_fields: str):
            query = db.table("contents").select(select_fields).eq(
                "user_id", user_id
            ).eq("is_archived", False)

            # Apply taxonomy filters
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

            # Apply simple filters via Supabase
            if data.processing_status and len(data.processing_status) == 1:
                query = query.eq("processing_status", data.processing_status[0])
            if data.maturity_level and len(data.maturity_level) == 1:
                query = query.eq("maturity_level", data.maturity_level[0])

            return query

        if not needs_python_filter:
            # Use DB pagination directly - most efficient
            # First get total count
            count_query = build_base_query("id")
            count_response = count_query.execute()
            total = len(count_response.data or [])

            # Then get paginated results
            data_query = build_base_query(
                "id, title, type, url, iab_tier1, summary, created_at, metadata"
            ).order("created_at", desc=True).range(data.offset, data.offset + data.limit - 1)

            response = data_query.execute()

            return {
                "contents": response.data or [],
                "total": total,
                "offset": data.offset,
                "limit": data.limit
            }

        # Need Python filtering - use batched approach
        BATCH_SIZE = 1000
        offset = 0
        all_filtered = []

        def matches_filters(item):
            # Type filter
            if active_type_filters:
                item_type = item.get("type")
                metadata = item.get("metadata") or {}
                if item_type == "note" and metadata.get("source") == "apple_notes":
                    effective_type = "apple_notes"
                else:
                    effective_type = item_type
                if effective_type not in active_type_filters:
                    return False

            # Processing status filter (multiple values)
            if data.processing_status and len(data.processing_status) > 1:
                if item.get("processing_status") not in data.processing_status:
                    return False

            # Maturity level filter (multiple values)
            if data.maturity_level and len(data.maturity_level) > 1:
                item_maturity = item.get("maturity_level") or "captured"
                if item_maturity not in data.maturity_level:
                    return False

            # Has comment filter
            if data.has_comment is not None:
                user_note = item.get("user_note")
                has_note = user_note and user_note.strip()
                if data.has_comment and not has_note:
                    return False
                if not data.has_comment and has_note:
                    return False

            # Favorite filter
            if data.is_favorite is not None:
                item_favorite = item.get("is_favorite") is True
                if data.is_favorite and not item_favorite:
                    return False
                if not data.is_favorite and item_favorite:
                    return False

            return True

        # Fetch and filter in batches until we have enough for pagination
        while True:
            query = build_base_query(
                "id, title, type, url, iab_tier1, summary, created_at, metadata, processing_status, maturity_level, user_note, is_favorite"
            ).order("created_at", desc=True).range(offset, offset + BATCH_SIZE - 1)

            response = query.execute()
            items = response.data or []

            if not items:
                break

            # Filter this batch
            for item in items:
                if matches_filters(item):
                    all_filtered.append(item)

            offset += BATCH_SIZE

            # If we have enough items for the requested page, we can stop fetching
            # but we need the total count, so continue until done
            if len(items) < BATCH_SIZE:
                break

        # Apply pagination to filtered results
        total = len(all_filtered)
        paginated = all_filtered[data.offset:data.offset + data.limit]

        return {
            "contents": paginated,
            "total": total,
            "offset": data.offset,
            "limit": data.limit
        }

    except Exception as e:
        import traceback
        logger.error(f"Taxonomy contents error: {e}\n{traceback.format_exc()}")
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
    Uses optimized SQL aggregation for large datasets.
    """
    try:
        user_id = current_user["id"]

        # Use RPC to get type counts with SQL aggregation
        # This is much more efficient than loading all records
        try:
            result = db.rpc("get_content_type_counts", {"p_user_id": user_id}).execute()
            if result.data:
                types = [
                    {"value": row["type_value"], "label": _get_type_label(row["type_value"]), "count": row["count"]}
                    for row in result.data
                ]
                types.sort(key=lambda x: x["count"], reverse=True)
                return {"types": types}
        except Exception as rpc_error:
            logger.warning(f"RPC get_content_type_counts not available, falling back: {rpc_error}")

        # Fallback: Use simple GROUP BY through Supabase
        # Get regular types count
        response = db.table("contents").select(
            "type", count="exact"
        ).eq("user_id", user_id).eq("is_archived", False).execute()

        # We need to count types, but Supabase select doesn't do GROUP BY easily
        # So we use a more efficient approach: get distinct types first
        # then count each (still better than loading all records)

        # Get all unique types
        types_response = db.table("contents").select("type").eq(
            "user_id", user_id
        ).eq("is_archived", False).execute()

        unique_types = set()
        for item in types_response.data or []:
            if item.get("type"):
                unique_types.add(item["type"])

        type_counts = {}
        for t in unique_types:
            if t == "note":
                # Count regular notes (not apple_notes)
                regular_notes = db.table("contents").select(
                    "id", count="exact"
                ).eq("user_id", user_id).eq("is_archived", False).eq(
                    "type", "note"
                ).neq("metadata->>source", "apple_notes").execute()

                # Count apple_notes
                apple_notes = db.table("contents").select(
                    "id", count="exact"
                ).eq("user_id", user_id).eq("is_archived", False).eq(
                    "type", "note"
                ).eq("metadata->>source", "apple_notes").execute()

                if regular_notes.count and regular_notes.count > 0:
                    type_counts["note"] = regular_notes.count
                if apple_notes.count and apple_notes.count > 0:
                    type_counts["apple_notes"] = apple_notes.count
            else:
                count_response = db.table("contents").select(
                    "id", count="exact"
                ).eq("user_id", user_id).eq("is_archived", False).eq("type", t).execute()
                if count_response.count and count_response.count > 0:
                    type_counts[t] = count_response.count

        types = [
            {"value": k, "label": _get_type_label(k), "count": v}
            for k, v in type_counts.items()
        ]
        types.sort(key=lambda x: x["count"], reverse=True)

        return {"types": types}

    except Exception as e:
        import traceback
        logger.error(f"Types error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def _get_type_label(type_value: str) -> str:
    """Get human-readable label for content type."""
    labels = {
        "article": "Articulos",
        "video": "Youtube",
        "note": "Notas",
        "apple_notes": "Apple Notes",
        "pdf": "PDFs",
        "tweet": "Twitter",
        "thread": "Threads",
        "tiktok": "Tiktok",
        "web": "Web",
        "podcast": "Podcasts",
    }
    return labels.get(type_value, type_value.capitalize())


@router.get("/")
async def get_available_categories(
    current_user: CurrentUser,
    db: Database
):
    """
    Get all available categories for the classification editor dropdown.
    Returns both AI-assigned categories (iab_tier1) and user-created categories (user_category).
    """
    try:
        user_id = current_user["id"]

        # Get all unique categories from both iab_tier1 and user_category
        # Use batched fetching for large datasets
        all_categories = set()
        offset = 0
        batch_size = 1000

        while True:
            response = db.table("contents").select(
                "iab_tier1, user_category"
            ).eq("user_id", user_id).neq("is_archived", True).range(
                offset, offset + batch_size - 1
            ).execute()

            items = response.data or []
            if not items:
                break

            for item in items:
                # Add AI category
                if item.get("iab_tier1"):
                    all_categories.add(item["iab_tier1"])
                # Add user category
                if item.get("user_category"):
                    all_categories.add(item["user_category"])

            if len(items) < batch_size:
                break
            offset += batch_size

        # Sort and format for dropdown
        sorted_categories = sorted(list(all_categories))
        categories = [{"name": cat} for cat in sorted_categories]

        return {
            "categories": categories,
            "total": len(categories)
        }

    except Exception as e:
        import traceback
        logger.error(f"Categories error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
