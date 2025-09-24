"""Lightweight metrics instrumentation helpers for the API service."""

from __future__ import annotations

import logging
import os
import socket
import threading
from dataclasses import dataclass
from functools import lru_cache
from typing import Mapping, Protocol

_METRICS_LOGGER_NAME = "bit_indie.metrics"
DEFAULT_METRICS_PREFIX = "bit_indie"
_DEFAULT_STATSD_PORT = 8125


class MetricsClient(Protocol):
    """Interface exposed by metric backends used throughout the service."""

    def increment(
        self,
        metric: str,
        *,
        value: int = 1,
        tags: Mapping[str, str] | None = None,
    ) -> None:
        """Increment the counter identified by ``metric`` by ``value``."""

    def gauge(
        self,
        metric: str,
        *,
        value: float,
        tags: Mapping[str, str] | None = None,
    ) -> None:
        """Publish a gauge observation for ``metric`` using the supplied value."""

    def observe(
        self,
        metric: str,
        *,
        value: float,
        tags: Mapping[str, str] | None = None,
    ) -> None:
        """Record a timing or histogram style observation for ``metric``."""


def _format_tags(tags: Mapping[str, str] | None) -> str:
    """Return Datadog/StatsD compatible tag payloads."""

    if not tags:
        return ""
    tag_components = [f"{key}:{value}" for key, value in sorted(tags.items())]
    return "|#" + ",".join(tag_components)


class _BaseMetricsClient:
    """Common helpers shared between metric client implementations."""

    def __init__(self, *, prefix: str = DEFAULT_METRICS_PREFIX) -> None:
        self._prefix = prefix.rstrip(".")

    def _namespaced(self, metric: str) -> str:
        """Return the metric name prefixed with the configured namespace."""

        metric_name = metric.lstrip(".")
        if not self._prefix:
            return metric_name
        return f"{self._prefix}.{metric_name}"


class LoggingMetricsClient(_BaseMetricsClient):
    """Metrics backend that emits structured log records."""

    def __init__(self, *, prefix: str = DEFAULT_METRICS_PREFIX) -> None:
        super().__init__(prefix=prefix)
        self._logger = logging.getLogger(_METRICS_LOGGER_NAME)

    def increment(
        self,
        metric: str,
        *,
        value: int = 1,
        tags: Mapping[str, str] | None = None,
    ) -> None:
        payload = {
            "metric": self._namespaced(metric),
            "type": "counter",
            "value": value,
            "tags": dict(tags) if tags else None,
        }
        self._logger.info("metrics.increment", extra={"metrics": payload})

    def gauge(
        self,
        metric: str,
        *,
        value: float,
        tags: Mapping[str, str] | None = None,
    ) -> None:
        payload = {
            "metric": self._namespaced(metric),
            "type": "gauge",
            "value": float(value),
            "tags": dict(tags) if tags else None,
        }
        self._logger.info("metrics.gauge", extra={"metrics": payload})

    def observe(
        self,
        metric: str,
        *,
        value: float,
        tags: Mapping[str, str] | None = None,
    ) -> None:
        payload = {
            "metric": self._namespaced(metric),
            "type": "distribution",
            "value": float(value),
            "tags": dict(tags) if tags else None,
        }
        self._logger.info("metrics.observe", extra={"metrics": payload})


class StatsdMetricsClient(_BaseMetricsClient):
    """Very small StatsD-compatible UDP client."""

    def __init__(
        self,
        *,
        host: str,
        port: int = _DEFAULT_STATSD_PORT,
        prefix: str = DEFAULT_METRICS_PREFIX,
    ) -> None:
        super().__init__(prefix=prefix)
        self._address = (host, port)
        self._logger = logging.getLogger(_METRICS_LOGGER_NAME)
        self._socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._lock = threading.Lock()

    def increment(
        self,
        metric: str,
        *,
        value: int = 1,
        tags: Mapping[str, str] | None = None,
    ) -> None:
        payload = f"{self._namespaced(metric)}:{value}|c{_format_tags(tags)}"
        self._send(payload)

    def gauge(
        self,
        metric: str,
        *,
        value: float,
        tags: Mapping[str, str] | None = None,
    ) -> None:
        payload = f"{self._namespaced(metric)}:{value}|g{_format_tags(tags)}"
        self._send(payload)

    def observe(
        self,
        metric: str,
        *,
        value: float,
        tags: Mapping[str, str] | None = None,
    ) -> None:
        payload = f"{self._namespaced(metric)}:{value}|ms{_format_tags(tags)}"
        self._send(payload)

    def _send(self, payload: str) -> None:
        """Transmit the encoded StatsD payload, logging on transient failures."""

        try:
            with self._lock:
                self._socket.sendto(payload.encode("utf-8"), self._address)
        except OSError as exc:  # pragma: no cover - network errors are non-deterministic
            self._logger.warning("metrics.emit_failed", extra={"error": str(exc), "payload": payload})


@dataclass(frozen=True)
class MetricsSettings:
    """Configuration describing which metrics backend should be used."""

    backend: str
    prefix: str
    statsd_host: str | None
    statsd_port: int

    @classmethod
    def from_environment(cls) -> "MetricsSettings":
        """Parse environment variables to determine the metrics backend."""

        backend = (os.getenv("METRICS_BACKEND") or "").strip().lower() or "logging"
        prefix = (os.getenv("METRICS_PREFIX") or DEFAULT_METRICS_PREFIX).strip()
        host = (os.getenv("STATSD_HOST") or "").strip() or None
        port_value = (os.getenv("STATSD_PORT") or "").strip()
        port = _DEFAULT_STATSD_PORT
        if port_value:
            try:
                port = int(port_value)
            except ValueError:
                port = _DEFAULT_STATSD_PORT
        if backend == "statsd" and not host:
            backend = "logging"
        if host and backend != "statsd":
            backend = "statsd"
        return cls(backend=backend, prefix=prefix, statsd_host=host, statsd_port=port)


@lru_cache(maxsize=1)
def get_metrics_client() -> MetricsClient:
    """Return a cached metrics client instance configured from the environment."""

    settings = MetricsSettings.from_environment()
    if settings.backend == "statsd" and settings.statsd_host:
        return StatsdMetricsClient(
            host=settings.statsd_host,
            port=settings.statsd_port,
            prefix=settings.prefix,
        )
    return LoggingMetricsClient(prefix=settings.prefix)


def reset_metrics_client_cache() -> None:
    """Clear cached metrics client references. Intended for use in tests."""

    get_metrics_client.cache_clear()


__all__ = [
    "LoggingMetricsClient",
    "MetricsClient",
    "MetricsSettings",
    "StatsdMetricsClient",
    "DEFAULT_METRICS_PREFIX",
    "get_metrics_client",
    "reset_metrics_client_cache",
]
