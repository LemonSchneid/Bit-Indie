"""Structured logging utilities and middleware for the API service."""

from __future__ import annotations

import json
import logging
import logging.config
import os
import time
import uuid
from contextlib import contextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Final, Iterator

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp


_REQUEST_ID_CONTEXT: ContextVar[str | None] = ContextVar("request_id", default=None)
_LOGGING_CONFIGURED: bool = False

DEFAULT_LOG_LEVEL: Final[str] = "INFO"
DEFAULT_REQUEST_ID_HEADER: Final[str] = "X-Request-ID"
_RESERVED_LOG_RECORD_FIELDS: Final[set[str]] = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
}


def _json_default(value: Any) -> Any:
    """Serialize objects that ``json.dumps`` does not support natively."""

    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {str(key): _json_default(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_default(item) for item in value]
    return str(value)


class JsonLogFormatter(logging.Formatter):
    """Formatter that renders log records as structured JSON payloads."""

    def format(self, record: logging.LogRecord) -> str:
        """Return the JSON encoded representation for ``record``."""

        record.message = record.getMessage()
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.message,
        }

        request_id = get_request_id()
        if request_id:
            payload["request_id"] = request_id

        extras = {
            key: value
            for key, value in record.__dict__.items()
            if key not in _RESERVED_LOG_RECORD_FIELDS and not key.startswith("_")
        }
        if extras:
            payload.update(extras)

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack_info"] = record.stack_info

        return json.dumps(payload, default=_json_default, separators=(",", ":"))


@dataclass(frozen=True)
class LoggingSettings:
    """Configuration describing the API logging behaviour."""

    level: str
    request_id_header: str

    @classmethod
    def from_environment(cls) -> "LoggingSettings":
        """Construct logging settings based on environment variables."""

        configured_level = (os.getenv("LOG_LEVEL") or DEFAULT_LOG_LEVEL).strip().upper()
        if configured_level not in logging.getLevelNamesMapping():
            configured_level = DEFAULT_LOG_LEVEL

        header = (os.getenv("REQUEST_ID_HEADER") or DEFAULT_REQUEST_ID_HEADER).strip()
        if not header:
            header = DEFAULT_REQUEST_ID_HEADER

        return cls(level=configured_level, request_id_header=header)


@lru_cache(maxsize=1)
def get_logging_settings() -> LoggingSettings:
    """Return cached logging settings for reuse across the application."""

    return LoggingSettings.from_environment()


def clear_logging_settings_cache() -> None:
    """Reset cached logging settings. Intended for unit tests."""

    get_logging_settings.cache_clear()


def configure_logging(settings: LoggingSettings) -> None:
    """Initialize structured logging for the API service."""

    global _LOGGING_CONFIGURED

    if _LOGGING_CONFIGURED:
        return

    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {"()": "bit_indie_api.core.logging.JsonLogFormatter"},
        },
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "formatter": "json",
            }
        },
        "root": {
            "handlers": ["default"],
            "level": settings.level,
        },
        "loggers": {
            "bit_indie": {
                "handlers": ["default"],
                "level": settings.level,
                "propagate": False,
            },
            "uvicorn": {
                "handlers": ["default"],
                "level": settings.level,
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": ["default"],
                "level": settings.level,
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["default"],
                "level": settings.level,
                "propagate": False,
            },
        },
    }

    logging.config.dictConfig(logging_config)
    _LOGGING_CONFIGURED = True


def get_request_id() -> str | None:
    """Return the request identifier bound to the current context."""

    return _REQUEST_ID_CONTEXT.get()


@contextmanager
def bind_request_id(request_id: str) -> Iterator[None]:
    """Bind ``request_id`` to the active context for the duration of the block."""

    token = _REQUEST_ID_CONTEXT.set(request_id)
    try:
        yield
    finally:
        _REQUEST_ID_CONTEXT.reset(token)


def _generate_request_id() -> str:
    """Return a new opaque request identifier."""

    return uuid.uuid4().hex


def _normalize_header(header_name: str) -> str:
    """Return a canonical header name for internal lookups."""

    return "-".join(part.capitalize() for part in header_name.split("-"))


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Middleware that attaches a request identifier to each request lifecycle."""

    def __init__(self, app: ASGIApp, *, header_name: str = DEFAULT_REQUEST_ID_HEADER) -> None:
        super().__init__(app)
        self._header_name = _normalize_header(header_name)

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        """Attach a request identifier and propagate it to the response headers."""

        incoming_request_id = request.headers.get(self._header_name)
        request_id = incoming_request_id or _generate_request_id()
        token: Token[str | None] = _REQUEST_ID_CONTEXT.set(request_id)

        try:
            response = await call_next(request)
        finally:
            _REQUEST_ID_CONTEXT.reset(token)

        response.headers.setdefault(self._header_name, request_id)
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware emitting structured request lifecycle logs."""

    def __init__(self, app: ASGIApp, *, logger: logging.Logger | None = None) -> None:
        super().__init__(app)
        self._logger = logger or logging.getLogger("bit_indie.request")

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        """Log a structured entry once the request has completed."""

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1_000

        payload = {
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 3),
        }

        if request.client and request.client.host:
            payload["client_ip"] = request.client.host

        request_id = get_request_id()
        if request_id:
            payload["request_id"] = request_id

        if request.query_params:
            payload["query"] = str(request.query_params)

        self._logger.info("request.completed", extra={"http": payload})
        return response


__all__ = [
    "JsonLogFormatter",
    "LoggingSettings",
    "RequestContextMiddleware",
    "RequestLoggingMiddleware",
    "bind_request_id",
    "clear_logging_settings_cache",
    "configure_logging",
    "get_logging_settings",
    "get_request_id",
]

