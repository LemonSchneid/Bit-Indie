"""Tests for the structured logging helpers and middleware."""

from __future__ import annotations

import json
import logging
from typing import Iterator

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from bit_indie_api.core.logging import (
    JsonLogFormatter,
    RequestContextMiddleware,
    RequestLoggingMiddleware,
    bind_request_id,
    clear_logging_settings_cache,
    configure_logging,
    get_logging_settings,
    get_request_id,
)


@pytest.fixture(autouse=True)
def reset_logging_environment(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Ensure logging configuration caches are cleared before each test."""

    monkeypatch.delenv("LOG_LEVEL", raising=False)
    monkeypatch.delenv("REQUEST_ID_HEADER", raising=False)
    clear_logging_settings_cache()
    monkeypatch.setattr("bit_indie_api.core.logging._LOGGING_CONFIGURED", False, raising=False)
    yield


def test_json_formatter_renders_structured_output() -> None:
    """Structured formatter should include request id and extras."""

    formatter = JsonLogFormatter()
    record = logging.LogRecord(
        name="bit_indie.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=42,
        msg="processed %s",
        args=("event",),
        exc_info=None,
    )
    record.metrics = {"counter": 1}

    with bind_request_id("req-123"):
        serialized = formatter.format(record)

    payload = json.loads(serialized)
    assert payload["message"] == "processed event"
    assert payload["level"] == "INFO"
    assert payload["request_id"] == "req-123"
    assert payload["metrics"] == {"counter": 1}


def test_request_context_middleware_generates_request_id() -> None:
    """Middleware should populate the context when the header is absent."""

    app = FastAPI()
    app.add_middleware(RequestContextMiddleware)

    @app.get("/probe")
    def probe() -> dict[str, str | None]:
        return {"request_id": get_request_id()}

    client = TestClient(app)
    response = client.get("/probe")
    assert response.status_code == 200
    generated_id = response.headers["X-Request-ID"]
    assert generated_id
    assert response.json()["request_id"] == generated_id


def test_request_context_middleware_preserves_header() -> None:
    """Existing request identifiers should flow through responses unchanged."""

    app = FastAPI()
    app.add_middleware(RequestContextMiddleware)

    @app.get("/probe")
    def probe() -> dict[str, str | None]:
        return {"request_id": get_request_id()}

    client = TestClient(app)
    response = client.get("/probe", headers={"X-Request-ID": "external"})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "external"
    assert response.json()["request_id"] == "external"


def test_request_logging_middleware_emits_structured_logs() -> None:
    """Requests should produce structured completion logs."""

    app = FastAPI()
    settings = get_logging_settings()
    configure_logging(settings)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/status")
    def status() -> dict[str, str]:
        return {"ok": "true"}

    client = TestClient(app)
    captured: list[logging.LogRecord] = []

    class _ListHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:  # noqa: D401
            """Collect log records for assertions."""

            captured.append(record)

    handler = _ListHandler()
    logger = logging.getLogger("bit_indie.request")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    try:
        response = client.get("/status")
    finally:
        logger.removeHandler(handler)

    assert response.status_code == 200
    assert captured, "Expected request log record to be emitted"
    record = captured[-1]
    assert record.message == "request.completed"
    assert isinstance(record.http, dict)
    assert record.http["status_code"] == 200
    assert record.http["method"] == "GET"
    assert record.http["path"] == "/status"
    assert record.http["duration_ms"] >= 0
