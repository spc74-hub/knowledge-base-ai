"""
Taxonomy Explorer API — disabled.

The taxonomy navigation feature relied on AI-extracted categories
(iab_tier*), concepts, and entities. Those columns were dropped in
migration 004 (CHANGELOG 2026-05-18) as part of the strategic-layer
refactor. The endpoints below stay so existing clients don't 404, but
they return empty trees.
"""
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class TaxonomyNode(BaseModel):
    id: str
    label: str
    count: int
    type: str


class TaxonomyResponse(BaseModel):
    nodes: List[TaxonomyNode]
    path: List[dict]
    total_contents: int


class _Body(BaseModel):
    pass


@router.post("/nodes", response_model=TaxonomyResponse)
async def get_taxonomy_nodes(data: _Body = None):
    return TaxonomyResponse(nodes=[], path=[], total_contents=0)


@router.post("/contents")
async def get_taxonomy_contents(data: _Body = None):
    return {"data": [], "meta": {"total_results": 0}}


@router.get("/types")
async def list_taxonomy_types():
    return {"types": []}


@router.post("/types")
async def create_taxonomy_type(data: _Body = None):
    return {"success": False, "message": "Taxonomy creation disabled"}


@router.get("/")
async def get_taxonomy_root():
    return {"nodes": [], "path": [], "total_contents": 0}
