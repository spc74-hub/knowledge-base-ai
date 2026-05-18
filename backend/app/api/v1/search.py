"""
Search endpoints (post AI-pipeline removal).

What works now:
  GET  /            full-text on title + summary
  GET  /suggestions title + user_tags suggestions
  POST /global      title + summary + user_tags
  POST /faceted     types + user_tags + has_comment + is_favorite + date + views
                    (no concepts/entities/iab_tier* — those columns are gone)

What returns 410 Gone (AI metadata removed):
  POST /semantic, /hybrid, /facets, /facets/dynamic, /graph
"""
from typing import List, Optional
import logging
import time

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------
class SearchResult(BaseModel):
    id: str
    title: str
    summary: Optional[str] = None
    type: str
    url: str
    relevance_score: float = 0.0
    highlight: Optional[dict] = None


class SearchResponse(BaseModel):
    data: List[SearchResult]
    meta: dict


# ---------------------------------------------------------------------------
# GET / — full-text search on title + summary
# ---------------------------------------------------------------------------
@router.get("/", response_model=SearchResponse)
async def search_text(
    current_user: CurrentUser,
    db: Database,
    q: str = Query(..., min_length=1),
    type: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
):
    start = time.time()
    query = (
        db.table("contents")
        .select("id, title, summary, type, url")
        .eq("user_id", current_user["id"])
        .neq("is_archived", True)
        .or_(f"title.ilike.%{q}%,summary.ilike.%{q}%")
    )
    if type:
        query = query.eq("type", type)

    response = await query.limit(limit).execute()

    q_lower = q.lower()
    results = []
    for item in response.data or []:
        score = 0.0
        title = item.get("title") or ""
        summary = item.get("summary") or ""
        if q_lower in title.lower():
            score += 0.6
        if q_lower in summary.lower():
            score += 0.4

        highlight = {}
        if q_lower in title.lower():
            highlight["title"] = title.replace(q, f"<mark>{q}</mark>")
        if q_lower in summary.lower():
            highlight["summary"] = summary.replace(q, f"<mark>{q}</mark>")

        results.append({
            **item,
            "relevance_score": score,
            "highlight": highlight or None,
        })

    results.sort(key=lambda x: x["relevance_score"], reverse=True)

    return {
        "data": results,
        "meta": {
            "query": q,
            "total_results": len(results),
            "search_time_ms": int((time.time() - start) * 1000),
        },
    }


# ---------------------------------------------------------------------------
# 410 Gone endpoints — AI metadata pipeline was removed (CHANGELOG 2026-05-18)
# ---------------------------------------------------------------------------
def _gone(feature: str):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=f"{feature} has been removed. AI metadata pipeline no longer runs in Kbia.",
    )


class _Body(BaseModel):
    query: Optional[str] = None
    limit: int = 10


@router.post("/semantic")
async def search_semantic(data: _Body):
    _gone("Semantic search")


@router.post("/hybrid")
async def search_hybrid(data: _Body):
    _gone("Hybrid search")


@router.get("/facets")
async def get_facets(current_user: CurrentUser):
    _gone("Facets aggregation")


@router.post("/facets/dynamic")
async def get_dynamic_facets(current_user: CurrentUser):
    _gone("Dynamic facets")


@router.post("/graph")
async def get_knowledge_graph(current_user: CurrentUser):
    _gone("Knowledge graph")


# ---------------------------------------------------------------------------
# GET /suggestions — title + user_tags only
# ---------------------------------------------------------------------------
@router.get("/suggestions")
async def get_suggestions(
    current_user: CurrentUser,
    db: Database,
    q: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1, le=10),
):
    response = await (
        db.table("contents")
        .select("title")
        .eq("user_id", current_user["id"])
        .neq("is_archived", True)
        .ilike("title", f"%{q}%")
        .limit(limit)
        .execute()
    )
    suggestions = [item["title"] for item in (response.data or []) if item.get("title")]

    # Also harvest user_tags
    all_tags = set()
    offset = 0
    batch_size = 1000
    while True:
        tag_resp = await (
            db.table("contents")
            .select("user_tags")
            .eq("user_id", current_user["id"])
            .neq("is_archived", True)
            .range(offset, offset + batch_size - 1)
            .execute()
        )
        if not tag_resp.data:
            break
        for item in tag_resp.data:
            for tag in item.get("user_tags") or []:
                all_tags.add(tag)
        if len(tag_resp.data) < batch_size:
            break
        offset += batch_size

    matching_tags = [t for t in all_tags if q.lower() in t.lower()][:limit]
    return {"suggestions": list({*suggestions, *matching_tags})[:limit]}


# ---------------------------------------------------------------------------
# POST /global — search title + summary + user_tags
# ---------------------------------------------------------------------------
class GlobalSearchRequest(BaseModel):
    query: str
    limit: int = 100
    offset: int = 0


@router.post("/global")
async def search_global(
    data: GlobalSearchRequest,
    current_user: CurrentUser,
    db: Database,
):
    start = time.time()
    raw = data.query.strip()
    if not raw:
        return {"data": [], "meta": {"query": data.query, "total_results": 0}}

    is_phrase = (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'"))
    if is_phrase:
        phrase = raw[1:-1].lower().strip()
        terms = [phrase]
    else:
        phrase = raw.lower()
        terms = [t for t in phrase.split() if t]

    def matches_all(text: str) -> bool:
        text_lower = text.lower()
        return all(t in text_lower for t in terms)

    def matches_phrase(text: str) -> bool:
        return phrase in text.lower()

    matcher = matches_phrase if is_phrase else matches_all

    response = await (
        db.table("contents")
        .select("id, title, summary, url, type, user_tags, source_metadata, is_favorite, view_count, created_at")
        .eq("user_id", current_user["id"])
        .neq("is_archived", True)
        .execute()
    )
    all_contents = response.data or []

    scored = []
    for c in all_contents:
        score = 0.0
        fields = []
        title = c.get("title") or ""
        summary = c.get("summary") or ""

        if matcher(title):
            score += 1.0
            fields.append("title")
        if matcher(summary):
            score += 0.5
            fields.append("summary")

        for tag in c.get("user_tags") or []:
            if matcher(tag):
                score += 0.6
                fields.append(f"tag:{tag}")
                break

        if score > 0:
            scored.append({**c, "relevance_score": score, "match_fields": fields})

    scored.sort(key=lambda x: x["relevance_score"], reverse=True)
    paginated = scored[data.offset:data.offset + data.limit]

    return {
        "data": paginated,
        "meta": {
            "query": data.query,
            "total_results": len(scored),
            "returned_results": len(paginated),
            "search_time_ms": int((time.time() - start) * 1000),
            "offset": data.offset,
            "limit": data.limit,
        },
    }


# ---------------------------------------------------------------------------
# POST /faceted — trimmed: types + user_tags + has_comment + is_favorite +
#                 date + views + sort + query in title/summary
# ---------------------------------------------------------------------------
class FacetedSearchRequest(BaseModel):
    query: Optional[str] = None
    types: Optional[List[str]] = None
    types_exclude: Optional[List[str]] = None
    user_tags: Optional[List[str]] = None
    has_comment: Optional[bool] = None
    is_favorite: Optional[bool] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    min_views: Optional[int] = None
    max_views: Optional[int] = None
    sort_by: Optional[str] = "created_at"
    sort_order: Optional[str] = "desc"
    limit: int = 50
    offset: int = 0


SEARCH_FIELDS = (
    "id, title, summary, url, type, user_tags, user_note, source_metadata, "
    "is_favorite, view_count, created_at, metadata"
)


def _apply_type_filter(query, types: List[str]):
    """Apple Notes are stored as type='note' with metadata.source='apple_notes'."""
    has_apple = "apple_notes" in types
    has_note = "note" in types
    other = [t for t in types if t not in ("apple_notes", "note")]

    if has_apple and has_note:
        return query.in_("type", other + ["note"]) if other else query.eq("type", "note")
    if has_apple:
        if other:
            return query.in_("type", other + ["note"])
        return query.eq("type", "note").filter("metadata->>source", "eq", "apple_notes")
    if has_note:
        if other:
            return query.in_("type", other + ["note"])
        return query.eq("type", "note").neq("metadata->>source", "apple_notes")
    return query.in_("type", types)


def _apply_sort(query, sort_by: str, sort_order: str):
    if sort_by not in {"created_at", "view_count", "title"}:
        sort_by = "created_at"
    desc = sort_order == "desc"
    if sort_by == "view_count":
        return query.order(sort_by, desc=desc, nullsfirst=not desc)
    return query.order(sort_by, desc=desc)


@router.post("/faceted")
async def search_faceted(
    data: FacetedSearchRequest,
    current_user: CurrentUser,
    db: Database,
):
    start = time.time()

    query = (
        db.table("contents")
        .select(SEARCH_FIELDS)
        .eq("user_id", current_user["id"])
        .neq("is_archived", True)
    )

    if data.types:
        query = _apply_type_filter(query, data.types)
    if data.user_tags:
        query = query.overlaps("user_tags", data.user_tags)
    if data.has_comment is True:
        query = query.not_.is_("user_note", None).neq("user_note", "")
    elif data.has_comment is False:
        query = query.or_("user_note.is.null,user_note.eq.")
    if data.is_favorite is True:
        query = query.eq("is_favorite", True)
    elif data.is_favorite is False:
        query = query.neq("is_favorite", True)
    if data.date_from:
        query = query.gte("created_at", f"{data.date_from}T00:00:00")
    if data.date_to:
        query = query.lte("created_at", f"{data.date_to}T23:59:59")
    if data.min_views is not None:
        query = query.gte("view_count", data.min_views)
    if data.max_views is not None:
        query = query.lte("view_count", data.max_views)

    query = _apply_sort(query, data.sort_by, data.sort_order)
    response = await query.range(data.offset, data.offset + data.limit - 1).execute()
    results = response.data or []

    # Post-filter: types_exclude (apple_notes distinction lives in metadata.source)
    if data.types_exclude:
        def effective(r):
            if r.get("type") == "note" and (r.get("metadata") or {}).get("source") == "apple_notes":
                return "apple_notes"
            return r.get("type")
        results = [r for r in results if effective(r) not in data.types_exclude]

    # Post-filter: text query on title/summary
    if data.query:
        ql = data.query.lower()
        scored = []
        for item in results:
            score = 0.0
            if ql in (item.get("title") or "").lower():
                score += 0.5
            if ql in (item.get("summary") or "").lower():
                score += 0.3
            if score > 0:
                scored.append({**item, "relevance_score": score})
        results = sorted(scored, key=lambda x: x["relevance_score"], reverse=True)

    return {
        "data": results,
        "meta": {
            "query": data.query,
            "filters": {
                "types": data.types,
                "user_tags": data.user_tags,
                "is_favorite": data.is_favorite,
            },
            "total_results": len(results),
            "search_time_ms": int((time.time() - start) * 1000),
            "offset": data.offset,
            "limit": data.limit,
        },
    }
