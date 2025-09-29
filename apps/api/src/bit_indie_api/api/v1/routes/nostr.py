"""Placeholder router for legacy Nostr endpoints removed from the API."""

from fastapi import APIRouter

router = APIRouter(prefix="/v1/nostr", tags=["nostr"])

__all__ = ["router"]
