"""
Search endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser
from app.services.embeddings import embeddings_service

router = APIRouter()


class SearchResult(BaseModel):
    id: str
    title: str
    summary: Optional[str] = None
    type: str
    url: str
    relevance_score: float = 0.0
    highlight: Optional[dict] = None


class SemanticSearchRequest(BaseModel):
    query: str
    limit: int = 10
    threshold: float = 0.7
    filters: Optional[dict] = None


class HybridSearchRequest(BaseModel):
    query: str
    semantic_weight: float = 0.5
    limit: int = 10


class SearchResponse(BaseModel):
    data: List[SearchResult]
    meta: dict


@router.get("/", response_model=SearchResponse)
async def search_text(
    current_user: CurrentUser,
    db: Database,
    q: str = Query(..., min_length=1),
    type: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100)
):
    """
    Full-text search across user's contents.
    """
    try:
        import time
        start_time = time.time()

        # Build query - search in title and summary
        query = db.table("contents").select("id, title, summary, type, url").eq("user_id", current_user["id"]).or_(f"title.ilike.%{q}%,summary.ilike.%{q}%")

        if type:
            query = query.eq("type", type)
        if category:
            query = query.eq("iab_tier1", category)

        query = query.limit(limit)

        response = query.execute()

        # Calculate relevance scores (simple implementation)
        results = []
        for item in response.data:
            score = 0.0
            q_lower = q.lower()

            # Title match scores higher
            if item.get("title") and q_lower in item["title"].lower():
                score += 0.6
            # Summary match
            if item.get("summary") and q_lower in item["summary"].lower():
                score += 0.4

            # Create highlights
            highlight = {}
            if item.get("title") and q_lower in item["title"].lower():
                highlight["title"] = item["title"].replace(q, f"<mark>{q}</mark>")
            if item.get("summary") and q_lower in item["summary"].lower():
                highlight["summary"] = item["summary"].replace(q, f"<mark>{q}</mark>")

            results.append({
                **item,
                "relevance_score": score,
                "highlight": highlight if highlight else None
            })

        # Sort by relevance
        results.sort(key=lambda x: x["relevance_score"], reverse=True)

        search_time = int((time.time() - start_time) * 1000)

        return {
            "data": results,
            "meta": {
                "query": q,
                "total_results": len(results),
                "search_time_ms": search_time
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/semantic", response_model=SearchResponse)
async def search_semantic(
    data: SemanticSearchRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Semantic search using embeddings.
    """
    try:
        import time
        start_time = time.time()

        # Generate embedding for the query
        query_embedding = await embeddings_service.generate_embedding(data.query)

        # Call Supabase RPC function for vector search
        response = db.rpc(
            'match_contents',
            {
                'query_embedding': query_embedding,
                'match_threshold': data.threshold,
                'match_count': data.limit,
                'p_user_id': current_user["id"]
            }
        ).execute()

        results = []
        for item in response.data or []:
            results.append({
                "id": item["id"],
                "title": item["title"],
                "summary": item.get("summary"),
                "type": item["type"],
                "url": item["url"],
                "relevance_score": item.get("similarity", 0),
                "highlight": None
            })

        search_time = int((time.time() - start_time) * 1000)

        return {
            "data": results,
            "meta": {
                "query": data.query,
                "embedding_generated": True,
                "search_time_ms": search_time,
                "total_results": len(results)
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/hybrid", response_model=SearchResponse)
async def search_hybrid(
    data: HybridSearchRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Hybrid search combining text and semantic search.
    """
    try:
        import time
        start_time = time.time()

        # TODO: Implement hybrid search
        # 1. Run text search
        # 2. Run semantic search
        # 3. Combine scores with weights

        search_time = int((time.time() - start_time) * 1000)

        return {
            "data": [],
            "meta": {
                "query": data.query,
                "semantic_weight": data.semantic_weight,
                "search_time_ms": search_time,
                "message": "Hybrid search not yet implemented."
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/suggestions")
async def get_suggestions(
    current_user: CurrentUser,
    db: Database,
    q: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1, le=10)
):
    """
    Get search suggestions based on partial query.
    """
    try:
        # Search in titles for suggestions
        response = db.table("contents").select("title").eq("user_id", current_user["id"]).ilike("title", f"%{q}%").limit(limit).execute()

        suggestions = [item["title"] for item in response.data if item.get("title")]

        # Also search in concepts/tags
        tag_response = db.table("contents").select("user_tags, concepts").eq("user_id", current_user["id"]).execute()

        all_tags = set()
        for item in tag_response.data:
            if item.get("user_tags"):
                all_tags.update(item["user_tags"])
            if item.get("concepts"):
                all_tags.update(item["concepts"])

        # Filter tags that match query
        matching_tags = [tag for tag in all_tags if q.lower() in tag.lower()][:limit]

        return {
            "suggestions": list(set(suggestions + matching_tags))[:limit]
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


class GlobalSearchRequest(BaseModel):
    """Request model for global search across all content fields."""
    query: str
    limit: int = 100
    offset: int = 0


@router.post("/global")
async def search_global(
    data: GlobalSearchRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Global search that searches across ALL content fields:
    - Title and summary (text content)
    - Concepts
    - Entities (persons, organizations, products)
    - Categories (iab_tier1, iab_tier2)
    - User tags

    Returns contents that match the query in ANY of these fields.
    """
    try:
        import time
        start_time = time.time()

        query_lower = data.query.lower().strip()
        if not query_lower:
            return {"data": [], "meta": {"query": data.query, "total_results": 0}}

        # Get all user contents with searchable fields
        response = db.table("contents").select(
            "id, title, summary, url, type, iab_tier1, iab_tier2, iab_tier3, concepts, entities, "
            "schema_type, content_format, technical_level, language, sentiment, "
            "reading_time_minutes, processing_status, is_favorite, metadata, user_tags, created_at"
        ).eq("user_id", current_user["id"]).execute()

        all_contents = response.data or []

        # Score and filter contents based on match
        scored_results = []

        for content in all_contents:
            score = 0.0
            match_fields = []

            # Search in title (highest weight)
            title = (content.get("title") or "").lower()
            if query_lower in title:
                score += 1.0
                match_fields.append("title")

            # Search in summary
            summary = (content.get("summary") or "").lower()
            if query_lower in summary:
                score += 0.5
                match_fields.append("summary")

            # Search in concepts
            concepts = content.get("concepts") or []
            for concept in concepts:
                if query_lower in concept.lower():
                    score += 0.7
                    match_fields.append(f"concept:{concept}")
                    break

            # Search in categories
            for tier in ["iab_tier1", "iab_tier2", "iab_tier3"]:
                cat = (content.get(tier) or "").lower()
                if cat and query_lower in cat:
                    score += 0.6
                    match_fields.append(f"category:{content.get(tier)}")
                    break

            # Search in entities
            entities = content.get("entities") or {}

            # Persons
            for person in entities.get("persons") or []:
                person_name = person.get("name") if isinstance(person, dict) else person
                if person_name and query_lower in person_name.lower():
                    score += 0.8
                    match_fields.append(f"person:{person_name}")
                    break

            # Organizations
            for org in entities.get("organizations") or []:
                org_name = org.get("name") if isinstance(org, dict) else org
                if org_name and query_lower in org_name.lower():
                    score += 0.8
                    match_fields.append(f"organization:{org_name}")
                    break

            # Products
            for prod in entities.get("products") or []:
                prod_name = prod.get("name") if isinstance(prod, dict) else prod
                if prod_name and query_lower in prod_name.lower():
                    score += 0.8
                    match_fields.append(f"product:{prod_name}")
                    break

            # Search in user_tags
            user_tags = content.get("user_tags") or []
            for tag in user_tags:
                if query_lower in tag.lower():
                    score += 0.6
                    match_fields.append(f"tag:{tag}")
                    break

            # If any match found, add to results
            if score > 0:
                scored_results.append({
                    **content,
                    "relevance_score": score,
                    "match_fields": match_fields
                })

        # Sort by relevance score
        scored_results.sort(key=lambda x: x["relevance_score"], reverse=True)

        # Apply pagination
        paginated_results = scored_results[data.offset:data.offset + data.limit]

        search_time = int((time.time() - start_time) * 1000)

        return {
            "data": paginated_results,
            "meta": {
                "query": data.query,
                "total_results": len(scored_results),
                "returned_results": len(paginated_results),
                "search_time_ms": search_time,
                "offset": data.offset,
                "limit": data.limit
            }
        }

    except Exception as e:
        import traceback
        print(f"Global search error: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def _aggregate_facets(items: list) -> dict:
    """Helper function to aggregate facets from a list of content items."""
    types = {}
    categories = {}
    concepts = {}
    organizations = {}
    products = {}
    persons = {}
    user_tags = {}

    for item in items:
        # Count types - distinguish apple_notes from regular notes
        t = item.get("type")
        if t:
            # Check if it's an Apple Note
            if t == "note":
                metadata = item.get("metadata") or {}
                if metadata.get("source") == "apple_notes":
                    types["apple_notes"] = types.get("apple_notes", 0) + 1
                else:
                    types[t] = types.get(t, 0) + 1
            else:
                types[t] = types.get(t, 0) + 1

        # Count categories (IAB tier1)
        cat = item.get("iab_tier1")
        if cat:
            categories[cat] = categories.get(cat, 0) + 1

        # Count concepts
        for concept in item.get("concepts") or []:
            concepts[concept] = concepts.get(concept, 0) + 1

        # Count entities - handle both string and dict formats
        entities = item.get("entities") or {}
        orgs_list = entities.get("organizations") or []
        for org in orgs_list:
            if isinstance(org, dict):
                org_name = org.get("name")
            elif isinstance(org, str):
                org_name = org
            else:
                continue
            if org_name:
                organizations[org_name] = organizations.get(org_name, 0) + 1

        prods_list = entities.get("products") or []
        for prod in prods_list:
            if isinstance(prod, dict):
                prod_name = prod.get("name")
            elif isinstance(prod, str):
                prod_name = prod
            else:
                continue
            if prod_name:
                products[prod_name] = products.get(prod_name, 0) + 1

        persons_list = entities.get("persons") or []
        for person in persons_list:
            if isinstance(person, dict):
                person_name = person.get("name")
            elif isinstance(person, str):
                person_name = person
            else:
                continue
            if person_name:
                persons[person_name] = persons.get(person_name, 0) + 1

        # Count user_tags
        for tag in item.get("user_tags") or []:
            if tag:
                user_tags[tag] = user_tags.get(tag, 0) + 1

    def to_facet_list(d):
        sorted_items = sorted(d.items(), key=lambda x: x[1], reverse=True)
        return [{"value": k, "count": v} for k, v in sorted_items]

    return {
        "types": to_facet_list(types),
        "categories": to_facet_list(categories),
        "concepts": to_facet_list(concepts),
        "organizations": to_facet_list(organizations),
        "products": to_facet_list(products),
        "persons": to_facet_list(persons),
        "user_tags": to_facet_list(user_tags),
        "total_contents": len(items)
    }


@router.get("/facets")
async def get_facets(
    current_user: CurrentUser,
    db: Database
):
    """
    Get available facets for filtering (no filters applied).
    Returns counts for each category, type, concept, and entity.
    Calculates facets from ALL user contents for accurate filtering.
    """
    try:
        # Get ALL content data for complete facet calculation
        # We fetch only the fields needed for facet aggregation
        all_response = db.table("contents").select(
            "type, metadata, iab_tier1, concepts, entities, user_tags"
        ).eq("user_id", current_user["id"]).execute()

        all_items = all_response.data or []
        total_contents = len(all_items)

        # Count types (with apple_notes handling)
        types = {}
        categories = {}
        concepts = {}
        organizations = {}
        products = {}
        persons = {}
        user_tags = {}

        for item in all_items:
            # Count types
            t = item.get("type")
            if t:
                if t == "note":
                    metadata = item.get("metadata") or {}
                    if metadata.get("source") == "apple_notes":
                        types["apple_notes"] = types.get("apple_notes", 0) + 1
                    else:
                        types[t] = types.get(t, 0) + 1
                else:
                    types[t] = types.get(t, 0) + 1

            # Count categories
            cat = item.get("iab_tier1")
            if cat:
                categories[cat] = categories.get(cat, 0) + 1

            # Count concepts
            for concept in item.get("concepts") or []:
                concepts[concept] = concepts.get(concept, 0) + 1

            # Count entities
            entities = item.get("entities") or {}
            for org in entities.get("organizations") or []:
                org_name = org.get("name") if isinstance(org, dict) else org
                if org_name:
                    organizations[org_name] = organizations.get(org_name, 0) + 1

            for prod in entities.get("products") or []:
                prod_name = prod.get("name") if isinstance(prod, dict) else prod
                if prod_name:
                    products[prod_name] = products.get(prod_name, 0) + 1

            for person in entities.get("persons") or []:
                person_name = person.get("name") if isinstance(person, dict) else person
                if person_name:
                    persons[person_name] = persons.get(person_name, 0) + 1

            # Count user_tags
            for tag in item.get("user_tags") or []:
                if tag:
                    user_tags[tag] = user_tags.get(tag, 0) + 1

        def to_facet_list(d, limit=None):
            """Convert dict to sorted facet list. No limit = return all."""
            sorted_items = sorted(d.items(), key=lambda x: x[1], reverse=True)
            if limit:
                sorted_items = sorted_items[:limit]
            return [{"value": k, "count": v} for k, v in sorted_items]

        return {
            "types": to_facet_list(types),
            "categories": to_facet_list(categories),
            "concepts": to_facet_list(concepts),
            "organizations": to_facet_list(organizations),
            "products": to_facet_list(products),
            "persons": to_facet_list(persons),
            "user_tags": to_facet_list(user_tags),
            "total_contents": total_contents
        }

    except Exception as e:
        import traceback
        print(f"Facets error: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


class DynamicFacetsRequest(BaseModel):
    types: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    concepts: Optional[List[str]] = None
    organizations: Optional[List[str]] = None
    products: Optional[List[str]] = None
    persons: Optional[List[str]] = None


@router.post("/facets/dynamic")
async def get_dynamic_facets(
    data: DynamicFacetsRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Get facets filtered by current selections.
    Returns counts that reflect what's available given the current filters.
    """
    try:
        # Helper to apply type filter including apple_notes handling
        def apply_type_filter_dynamic(query, types):
            if not types:
                return query
            has_apple_notes = "apple_notes" in types
            other_types = [t for t in types if t != "apple_notes"]
            if has_apple_notes and not other_types:
                # Use ->> operator for text comparison (extracts as text, not JSON)
                return query.eq("type", "note").filter("metadata->>source", "eq", "apple_notes")
            elif not has_apple_notes:
                return query.in_("type", types)
            return query.in_("type", other_types + ["note"])

        # Check if we have any entity filters
        has_entity_filters = data.organizations or data.products or data.persons

        if has_entity_filters:
            # For entity filters, we need to get IDs first
            all_ids = set()

            if data.organizations:
                for org in data.organizations:
                    q = db.table("contents").select("id").eq("user_id", current_user["id"])
                    if data.types:
                        q = apply_type_filter_dynamic(q, data.types)
                    if data.categories:
                        q = q.in_("iab_tier1", data.categories)
                    if data.concepts:
                        q = q.overlaps("concepts", data.concepts)
                    pattern = json_module.dumps([{"name": org}])
                    q = q.filter("entities->organizations", "cs", pattern)
                    resp = q.execute()
                    all_ids.update(item["id"] for item in resp.data or [])

            if data.products:
                for prod in data.products:
                    q = db.table("contents").select("id").eq("user_id", current_user["id"])
                    if data.types:
                        q = apply_type_filter_dynamic(q, data.types)
                    if data.categories:
                        q = q.in_("iab_tier1", data.categories)
                    if data.concepts:
                        q = q.overlaps("concepts", data.concepts)
                    pattern = json_module.dumps([{"name": prod}])
                    q = q.filter("entities->products", "cs", pattern)
                    resp = q.execute()
                    all_ids.update(item["id"] for item in resp.data or [])

            if data.persons:
                for person in data.persons:
                    q = db.table("contents").select("id").eq("user_id", current_user["id"])
                    if data.types:
                        q = apply_type_filter_dynamic(q, data.types)
                    if data.categories:
                        q = q.in_("iab_tier1", data.categories)
                    if data.concepts:
                        q = q.overlaps("concepts", data.concepts)
                    pattern = json_module.dumps([{"name": person}])
                    q = q.filter("entities->persons", "cs", pattern)
                    resp = q.execute()
                    all_ids.update(item["id"] for item in resp.data or [])

            if all_ids:
                response = db.table("contents").select(
                    "type, iab_tier1, concepts, entities, metadata"
                ).in_("id", list(all_ids)).execute()
                items = response.data or []
            else:
                items = []
        else:
            # Standard query without entity filters
            query = db.table("contents").select(
                "type, iab_tier1, concepts, entities, metadata"
            ).eq("user_id", current_user["id"])

            if data.types:
                query = apply_type_filter_dynamic(query, data.types)

            if data.categories:
                query = query.in_("iab_tier1", data.categories)

            if data.concepts:
                query = query.overlaps("concepts", data.concepts)

            response = query.execute()
            items = response.data or []

        return _aggregate_facets(items)

    except Exception as e:
        import traceback
        print(f"Dynamic facets error: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


class FacetedSearchRequest(BaseModel):
    query: Optional[str] = None
    types: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    concepts: Optional[List[str]] = None
    organizations: Optional[List[str]] = None
    products: Optional[List[str]] = None
    persons: Optional[List[str]] = None
    user_tags: Optional[List[str]] = None
    inherited_tags: Optional[List[str]] = None
    limit: int = 100  # Reduced from 10000 for better performance
    offset: int = 0


import json as json_module


def _build_jsonb_contains_filter(entity_type: str, values: List[str]) -> str:
    """
    Build a JSONB contains filter pattern for Supabase.
    Format: [{"name": "Value1"}, {"name": "Value2"}] - matches ANY of the values
    """
    patterns = [{"name": v} for v in values]
    return json_module.dumps(patterns)


@router.post("/faceted")
async def search_faceted(
    data: FacetedSearchRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Search with facet filters.
    Combines text search with facet filtering.
    Uses PostgreSQL JSONB contains operator for efficient entity filtering.
    """
    try:
        import time
        start_time = time.time()

        # Check if we need entity filtering (requires separate queries for OR logic)
        has_entity_filters = data.organizations or data.products or data.persons

        # Helper to apply type filter including apple_notes handling
        def apply_type_filter(query, types):
            if not types:
                return query
            has_apple_notes = "apple_notes" in types
            other_types = [t for t in types if t != "apple_notes"]
            if has_apple_notes and not other_types:
                # Only apple_notes
                return query.eq("type", "note").filter("metadata->>source", "eq", "apple_notes")
            elif not has_apple_notes:
                return query.in_("type", types)
            # Both apple_notes and other types - can't handle in single query for ID fetch
            return query.in_("type", other_types + ["note"])

        if has_entity_filters:
            # For entity filters, we need to do multiple queries and combine results
            # because Supabase doesn't support OR across different JSONB paths easily
            all_ids = set()

            # Query for each entity type filter
            if data.organizations:
                for org in data.organizations:
                    q = db.table("contents").select("id").eq("user_id", current_user["id"])
                    if data.types:
                        q = apply_type_filter(q, data.types)
                    if data.categories:
                        q = q.in_("iab_tier1", data.categories)
                    if data.concepts:
                        q = q.overlaps("concepts", data.concepts)
                    # Use filter with 'cs' (contains) for JSONB array matching
                    pattern = json_module.dumps([{"name": org}])
                    q = q.filter("entities->organizations", "cs", pattern)
                    resp = q.execute()
                    all_ids.update(item["id"] for item in resp.data or [])

            if data.products:
                for prod in data.products:
                    q = db.table("contents").select("id").eq("user_id", current_user["id"])
                    if data.types:
                        q = apply_type_filter(q, data.types)
                    if data.categories:
                        q = q.in_("iab_tier1", data.categories)
                    if data.concepts:
                        q = q.overlaps("concepts", data.concepts)
                    pattern = json_module.dumps([{"name": prod}])
                    q = q.filter("entities->products", "cs", pattern)
                    resp = q.execute()
                    all_ids.update(item["id"] for item in resp.data or [])

            if data.persons:
                for person in data.persons:
                    q = db.table("contents").select("id").eq("user_id", current_user["id"])
                    if data.types:
                        q = apply_type_filter(q, data.types)
                    if data.categories:
                        q = q.in_("iab_tier1", data.categories)
                    if data.concepts:
                        q = q.overlaps("concepts", data.concepts)
                    pattern = json_module.dumps([{"name": person}])
                    q = q.filter("entities->persons", "cs", pattern)
                    resp = q.execute()
                    all_ids.update(item["id"] for item in resp.data or [])

            # If we have matching IDs, fetch full content
            if all_ids:
                response = db.table("contents").select(
                    "id, title, summary, url, type, iab_tier1, iab_tier2, concepts, entities, "
                    "schema_type, content_format, technical_level, language, sentiment, "
                    "reading_time_minutes, processing_status, is_favorite, metadata, created_at"
                ).in_("id", list(all_ids)).order("created_at", desc=True).range(
                    data.offset, data.offset + data.limit - 1
                ).execute()
                results = response.data or []
            else:
                results = []
        else:
            # Standard query without entity filters
            query = db.table("contents").select(
                "id, title, summary, url, type, iab_tier1, iab_tier2, concepts, entities, "
                "schema_type, content_format, technical_level, language, sentiment, "
                "reading_time_minutes, processing_status, is_favorite, metadata, created_at"
            ).eq("user_id", current_user["id"])

            # Apply facet filters - handle apple_notes as special case
            if data.types:
                # Check if apple_notes is in the filter
                has_apple_notes = "apple_notes" in data.types
                other_types = [t for t in data.types if t != "apple_notes"]

                if has_apple_notes and other_types:
                    # Need to combine: (type in other_types) OR (type=note AND metadata.source=apple_notes)
                    # Supabase doesn't support complex OR, so we do two queries
                    query1 = db.table("contents").select(
                        "id, title, summary, url, type, iab_tier1, iab_tier2, concepts, entities, "
                        "schema_type, content_format, technical_level, language, sentiment, "
                        "reading_time_minutes, processing_status, is_favorite, metadata, created_at"
                    ).eq("user_id", current_user["id"]).in_("type", other_types)
                    if data.categories:
                        query1 = query1.in_("iab_tier1", data.categories)
                    if data.concepts:
                        query1 = query1.overlaps("concepts", data.concepts)

                    query2 = db.table("contents").select(
                        "id, title, summary, url, type, iab_tier1, iab_tier2, concepts, entities, "
                        "schema_type, content_format, technical_level, language, sentiment, "
                        "reading_time_minutes, processing_status, is_favorite, metadata, created_at"
                    ).eq("user_id", current_user["id"]).eq("type", "note").filter(
                        "metadata->>source", "eq", "apple_notes"
                    )
                    if data.categories:
                        query2 = query2.in_("iab_tier1", data.categories)
                    if data.concepts:
                        query2 = query2.overlaps("concepts", data.concepts)

                    resp1 = query1.order("created_at", desc=True).execute()
                    resp2 = query2.order("created_at", desc=True).execute()

                    # Combine and dedupe
                    seen_ids = set()
                    combined = []
                    for item in (resp1.data or []) + (resp2.data or []):
                        if item["id"] not in seen_ids:
                            seen_ids.add(item["id"])
                            combined.append(item)

                    # Sort by created_at and paginate
                    combined.sort(key=lambda x: x.get("created_at", ""), reverse=True)
                    results = combined[data.offset:data.offset + data.limit]

                elif has_apple_notes:
                    # Only apple_notes filter
                    query = query.eq("type", "note").filter("metadata->>source", "eq", "apple_notes")
                    if data.categories:
                        query = query.in_("iab_tier1", data.categories)
                    if data.concepts:
                        query = query.overlaps("concepts", data.concepts)
                    response = query.order("created_at", desc=True).range(
                        data.offset, data.offset + data.limit - 1
                    ).execute()
                    results = response.data or []
                else:
                    # No apple_notes, use standard in_ filter
                    query = query.in_("type", data.types)
                    if data.categories:
                        query = query.in_("iab_tier1", data.categories)
                    if data.concepts:
                        query = query.overlaps("concepts", data.concepts)
                    response = query.order("created_at", desc=True).range(
                        data.offset, data.offset + data.limit - 1
                    ).execute()
                    results = response.data or []
            else:
                if data.categories:
                    query = query.in_("iab_tier1", data.categories)

                # For concepts, check if any of the filter concepts are in the array
                if data.concepts:
                    query = query.overlaps("concepts", data.concepts)

                # Execute query with proper pagination
                response = query.order("created_at", desc=True).range(
                    data.offset, data.offset + data.limit - 1
                ).execute()

                results = response.data or []

        # Filter by user_tags (post-query for simplicity)
        if data.user_tags:
            results = [
                r for r in results
                if any(tag in (r.get("user_tags") or []) for tag in data.user_tags)
            ]

        # Filter by inherited_tags (requires checking taxonomy rules)
        if data.inherited_tags:
            # Get taxonomy_tags rules for current user
            taxonomy_result = db.table("taxonomy_tags").select("*").eq("user_id", current_user["id"]).in_("tag", data.inherited_tags).execute()
            taxonomy_rules = taxonomy_result.data or []

            def content_matches_inherited_tag(content: dict) -> bool:
                """Check if content matches any inherited tag rule."""
                for rule in taxonomy_rules:
                    rule_type = rule.get("taxonomy_type")
                    rule_value = rule.get("taxonomy_value")

                    if rule_type == "category":
                        if content.get("iab_tier1") == rule_value or \
                           content.get("iab_tier2") == rule_value or \
                           content.get("iab_tier3") == rule_value:
                            return True
                    elif rule_type == "concept":
                        concepts = content.get("concepts") or []
                        if rule_value in concepts:
                            return True
                    elif rule_type in ["person", "organization", "product"]:
                        entities = content.get("entities") or {}
                        entity_key = rule_type + "s"
                        entity_list = entities.get(entity_key) or []
                        for entity in entity_list:
                            if entity.get("name") == rule_value:
                                return True
                return False

            results = [r for r in results if content_matches_inherited_tag(r)]

        # If text query provided, filter and score results
        if data.query:
            query_lower = data.query.lower()
            scored_results = []
            for item in results:
                score = 0.0
                title = (item.get("title") or "").lower()
                summary = (item.get("summary") or "").lower()
                concepts_list = [c.lower() for c in (item.get("concepts") or [])]

                if query_lower in title:
                    score += 0.5
                if query_lower in summary:
                    score += 0.3
                if any(query_lower in c for c in concepts_list):
                    score += 0.2

                if score > 0:
                    scored_results.append({**item, "relevance_score": score})

            results = sorted(scored_results, key=lambda x: x["relevance_score"], reverse=True)

        search_time = int((time.time() - start_time) * 1000)

        return {
            "data": results,
            "meta": {
                "query": data.query,
                "filters": {
                    "types": data.types,
                    "categories": data.categories,
                    "concepts": data.concepts,
                    "organizations": data.organizations,
                    "products": data.products,
                    "persons": data.persons,
                    "user_tags": data.user_tags,
                    "inherited_tags": data.inherited_tags
                },
                "total_results": len(results),
                "search_time_ms": search_time,
                "offset": data.offset,
                "limit": data.limit
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


class GraphRequest(BaseModel):
    include_persons: bool = True
    include_organizations: bool = True
    include_products: bool = True
    include_concepts: bool = False
    min_connections: int = 1
    user_tags: Optional[List[str]] = None
    inherited_tags: Optional[List[str]] = None


@router.post("/graph")
async def get_knowledge_graph(
    data: GraphRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Generate a knowledge graph from entities.
    Returns nodes and edges for visualization.
    """
    try:
        # Get all contents with entities
        response = db.table("contents").select(
            "id, title, entities, concepts, user_tags, iab_tier1, iab_tier2, iab_tier3"
        ).eq("user_id", current_user["id"]).execute()

        contents = response.data or []

        # Filter by user_tags if provided
        if data.user_tags:
            contents = [
                c for c in contents
                if any(tag in (c.get("user_tags") or []) for tag in data.user_tags)
            ]

        # Filter by inherited_tags if provided
        if data.inherited_tags:
            taxonomy_result = db.table("taxonomy_tags").select("*").eq(
                "user_id", current_user["id"]
            ).in_("tag", data.inherited_tags).execute()
            taxonomy_rules = taxonomy_result.data or []

            def content_matches_inherited_tag(content: dict) -> bool:
                for rule in taxonomy_rules:
                    rule_type = rule.get("taxonomy_type")
                    rule_value = rule.get("taxonomy_value")

                    if rule_type == "category":
                        if content.get("iab_tier1") == rule_value or \
                           content.get("iab_tier2") == rule_value or \
                           content.get("iab_tier3") == rule_value:
                            return True
                    elif rule_type == "concept":
                        concepts = content.get("concepts") or []
                        if rule_value in concepts:
                            return True
                    elif rule_type in ["person", "organization", "product"]:
                        entities = content.get("entities") or {}
                        entity_key = rule_type + "s"
                        entity_list = entities.get(entity_key) or []
                        for entity in entity_list:
                            if entity.get("name") == rule_value:
                                return True
                return False

            contents = [c for c in contents if content_matches_inherited_tag(c)]

        # Build graph data
        nodes = {}  # id -> {id, label, type, count, contents}
        edges = {}  # "source-target" -> {source, target, weight, contents}
        content_titles = {}  # content_id -> title (for frontend to resolve)

        def get_entity_name(entity):
            if isinstance(entity, dict):
                return entity.get("name")
            return entity

        def add_node(name: str, node_type: str, content_id: str):
            if not name:
                return None
            node_id = f"{node_type}:{name}"
            if node_id not in nodes:
                nodes[node_id] = {
                    "id": node_id,
                    "label": name,
                    "type": node_type,
                    "count": 0,
                    "contents": []
                }
            nodes[node_id]["count"] += 1
            if content_id not in nodes[node_id]["contents"]:
                nodes[node_id]["contents"].append(content_id)
            return node_id

        def add_edge(source_id: str, target_id: str, content_id: str):
            if not source_id or not target_id or source_id == target_id:
                return
            # Ensure consistent ordering for edge key
            edge_key = tuple(sorted([source_id, target_id]))
            edge_key_str = f"{edge_key[0]}||{edge_key[1]}"
            if edge_key_str not in edges:
                edges[edge_key_str] = {
                    "source": edge_key[0],
                    "target": edge_key[1],
                    "weight": 0,
                    "contents": []
                }
            edges[edge_key_str]["weight"] += 1
            if content_id not in edges[edge_key_str]["contents"]:
                edges[edge_key_str]["contents"].append(content_id)

        # Process each content
        for item in contents:
            content_id = item["id"]
            content_title = item.get("title", "Sin titulo")
            content_titles[content_id] = content_title
            entities = item.get("entities") or {}
            concepts = item.get("concepts") or []

            # Collect all entity IDs for this content
            content_entities = []

            # Persons
            if data.include_persons:
                for person in entities.get("persons") or []:
                    name = get_entity_name(person)
                    node_id = add_node(name, "person", content_id)
                    if node_id:
                        content_entities.append(node_id)

            # Organizations
            if data.include_organizations:
                for org in entities.get("organizations") or []:
                    name = get_entity_name(org)
                    node_id = add_node(name, "organization", content_id)
                    if node_id:
                        content_entities.append(node_id)

            # Products
            if data.include_products:
                for prod in entities.get("products") or []:
                    name = get_entity_name(prod)
                    node_id = add_node(name, "product", content_id)
                    if node_id:
                        content_entities.append(node_id)

            # Concepts
            if data.include_concepts:
                for concept in concepts[:5]:  # Limit concepts per content
                    node_id = add_node(concept, "concept", content_id)
                    if node_id:
                        content_entities.append(node_id)

            # Create edges between all entities in this content
            for i, entity1 in enumerate(content_entities):
                for entity2 in content_entities[i + 1:]:
                    add_edge(entity1, entity2, content_id)

        # Filter by min_connections
        if data.min_connections > 1:
            # Find nodes that have at least min_connections edges
            node_edge_count = {}
            for edge in edges.values():
                node_edge_count[edge["source"]] = node_edge_count.get(edge["source"], 0) + 1
                node_edge_count[edge["target"]] = node_edge_count.get(edge["target"], 0) + 1

            valid_nodes = {n for n, c in node_edge_count.items() if c >= data.min_connections}
            nodes = {k: v for k, v in nodes.items() if k in valid_nodes}
            edges = {k: v for k, v in edges.items()
                     if v["source"] in valid_nodes and v["target"] in valid_nodes}

        return {
            "nodes": list(nodes.values()),
            "edges": list(edges.values()),
            "content_titles": content_titles,
            "stats": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "node_types": {
                    "persons": len([n for n in nodes.values() if n["type"] == "person"]),
                    "organizations": len([n for n in nodes.values() if n["type"] == "organization"]),
                    "products": len([n for n in nodes.values() if n["type"] == "product"]),
                    "concepts": len([n for n in nodes.values() if n["type"] == "concept"])
                }
            }
        }

    except Exception as e:
        import traceback
        print(f"Graph error: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
