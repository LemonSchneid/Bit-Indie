"""Health check endpoint for the Proof of Play API."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    """Payload returned by the health check endpoint."""

    status: str


@router.get("", response_model=HealthResponse, summary="Service health check")
async def get_health() -> HealthResponse:
    """Return a simple healthy status response."""

    return HealthResponse(status="ok")
