"""
API v1 routers.
"""
from fastapi import APIRouter

# Import only content for now (others will be added as needed)
from app.api.v1 import content

api_router = APIRouter()

api_router.include_router(content.router, prefix="/content", tags=["content"])
