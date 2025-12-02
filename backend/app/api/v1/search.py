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
        persons = {}

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

            persons_list = entities.get("persons") or []
            for person in persons_list:
                # Handle dict format
                if isinstance(person, dict):
                    person_name = person.get("name")
                elif isinstance(person, str):
                    person_name = person
                else:
                    continue
                if person_name:
                    persons[person_name] = persons.get(person_name, 0) + 1

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
            "persons": to_facet_list(persons),
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
    persons: Optional[List[str]] = None
    limit: int = 50
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

        if has_entity_filters:
            # For entity filters, we need to do multiple queries and combine results
            # because Supabase doesn't support OR across different JSONB paths easily
            all_ids = set()

            # Query for each entity type filter
            if data.organizations:
                for org in data.organizations:
                    q = db.table("contents").select("id").eq("user_id", current_user["id"])
                    if data.types:
                        q = q.in_("type", data.types)
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
                        q = q.in_("type", data.types)
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
                        q = q.in_("type", data.types)
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

            # Apply facet filters
            if data.types:
                query = query.in_("type", data.types)

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
                    "persons": data.persons
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
            "id, title, entities, concepts"
        ).eq("user_id", current_user["id"]).execute()

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
        for item in response.data or []:
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
