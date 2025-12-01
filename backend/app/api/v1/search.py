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


@router.get("/facets")
async def get_facets(
    current_user: CurrentUser,
    db: Database
):
    """
    Get available facets for filtering.
    Returns counts for each category, type, concept, and entity.
    """
    try:
        # Get all contents for the user
        response = db.table("contents").select(
            "type, iab_tier1, concepts, entities"
        ).eq("user_id", current_user["id"]).execute()

        # Aggregate facets
        types = {}
        categories = {}
        concepts = {}
        organizations = {}
        products = {}

        for item in response.data or []:
            # Count types
            t = item.get("type")
            if t:
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
                # Handle dict format (e.g., {"name": "...", "type": "..."})
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
                # Handle dict format
                if isinstance(prod, dict):
                    prod_name = prod.get("name")
                elif isinstance(prod, str):
                    prod_name = prod
                else:
                    continue
                if prod_name:
                    products[prod_name] = products.get(prod_name, 0) + 1

        # Sort by count and convert to list format
        def to_facet_list(d, limit=30):
            sorted_items = sorted(d.items(), key=lambda x: x[1], reverse=True)
            return [{"value": k, "count": v} for k, v in sorted_items[:limit]]

        return {
            "types": to_facet_list(types),
            "categories": to_facet_list(categories),
            "concepts": to_facet_list(concepts, limit=50),
            "organizations": to_facet_list(organizations),
            "products": to_facet_list(products),
            "total_contents": len(response.data or [])
        }

    except Exception as e:
        import traceback
        print(f"Facets error: {e}")
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
    limit: int = 50
    offset: int = 0


@router.post("/faceted")
async def search_faceted(
    data: FacetedSearchRequest,
    current_user: CurrentUser,
    db: Database
):
    """
    Search with facet filters.
    Combines text search with facet filtering.
    """
    try:
        import time
        start_time = time.time()

        # Start with base query
        query = db.table("contents").select(
            "id, title, summary, url, type, iab_tier1, concepts, entities, created_at"
        ).eq("user_id", current_user["id"])

        # Apply facet filters
        if data.types:
            query = query.in_("type", data.types)

        if data.categories:
            query = query.in_("iab_tier1", data.categories)

        # For concepts, we need to check if any of the filter concepts are in the array
        if data.concepts:
            query = query.overlaps("concepts", data.concepts)

        # Execute query
        response = query.order("created_at", desc=True).range(
            data.offset, data.offset + data.limit - 1
        ).execute()

        results = response.data or []

        # Post-filter by entities (Supabase doesn't support JSONB array contains easily)
        if data.organizations or data.products:
            filtered_results = []
            for item in results:
                entities = item.get("entities") or {}

                # Extract organization names (handle dict format)
                item_orgs = []
                for org in entities.get("organizations") or []:
                    org_name = org.get("name") if isinstance(org, dict) else org
                    if org_name:
                        item_orgs.append(org_name)

                # Extract product names (handle dict format)
                item_prods = []
                for prod in entities.get("products") or []:
                    prod_name = prod.get("name") if isinstance(prod, dict) else prod
                    if prod_name:
                        item_prods.append(prod_name)

                org_match = not data.organizations or any(
                    org in item_orgs for org in data.organizations
                )
                prod_match = not data.products or any(
                    prod in item_prods for prod in data.products
                )
                if org_match and prod_match:
                    filtered_results.append(item)
            results = filtered_results

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
                    "products": data.products
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
