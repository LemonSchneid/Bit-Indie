"""Helpers for extracting raw fields from FastAPI request bodies."""

from __future__ import annotations

import json
from json import JSONDecodeError
from typing import Any

from fastapi import Request


async def extract_json_str_field(request: Request, field_name: str) -> str | None:
    """Return ``field_name`` from the JSON payload when it is a string."""

    try:
        body_bytes = await request.body()
    except RuntimeError:
        return None
    if not body_bytes:
        return None

    try:
        payload: Any = json.loads(body_bytes)
    except JSONDecodeError:
        return None

    if not isinstance(payload, dict):
        return None

    value = payload.get(field_name)
    if isinstance(value, str):
        return value
    return None


async def extract_body_markdown(request: Request) -> str | None:
    """Return the raw ``body_md`` value from the incoming JSON payload."""

    return await extract_json_str_field(request=request, field_name="body_md")


__all__ = ["extract_body_markdown", "extract_json_str_field"]

