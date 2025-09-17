"""Tests for the FastAPI application skeleton and health route."""

from __future__ import annotations

from fastapi.testclient import TestClient

from proof_of_play_api.core.config import clear_settings_cache
from proof_of_play_api.main import create_application


def _build_client() -> TestClient:
    """Create a test client against a freshly configured application."""

    clear_settings_cache()
    return TestClient(create_application())


def test_health_endpoint_returns_ok(monkeypatch) -> None:
    """The health endpoint should report an OK status."""

    monkeypatch.delenv("API_ORIGINS", raising=False)
    client = _build_client()

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_swagger_ui_available(monkeypatch) -> None:
    """The automatically generated Swagger UI should be accessible."""

    monkeypatch.setenv("API_ORIGINS", "http://docs.test")
    client = _build_client()

    response = client.get("/docs")

    assert response.status_code == 200
    assert "Swagger UI" in response.text


def test_cors_headers_for_configured_origin(monkeypatch) -> None:
    """CORS middleware should reflect allowed origins from configuration."""

    origin = "http://allowed.test"
    monkeypatch.setenv("API_ORIGINS", origin)
    client = _build_client()

    response = client.options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin
