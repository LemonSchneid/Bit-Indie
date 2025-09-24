"""Application factory for the Proof of Play FastAPI service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from proof_of_play_api.api.v1.routes.admin import router as admin_router
from proof_of_play_api.api.v1.routes.admin_refunds import router as admin_refunds_router
from proof_of_play_api.api.v1.routes.admin_stats import router as admin_stats_router
from proof_of_play_api.api.v1.routes.auth import router as auth_router
from proof_of_play_api.api.v1.routes.comments import router as comments_router
from proof_of_play_api.api.v1.routes.developers import router as developers_router
from proof_of_play_api.api.v1.routes.games import router as games_router
from proof_of_play_api.api.v1.routes.health import router as health_router
from proof_of_play_api.api.v1.routes.nostr import router as nostr_router
from proof_of_play_api.api.v1.routes.purchases import router as purchases_router
from proof_of_play_api.api.v1.routes.users import router as users_router
from proof_of_play_api.api.v1.routes.reviews import router as reviews_router
from proof_of_play_api.api.v1.routes.zaps import router as zaps_router
from proof_of_play_api.core.config import get_settings
from proof_of_play_api.core.telemetry import (
    configure_telemetry,
    get_telemetry_settings,
)


def create_application() -> FastAPI:
    """Build and configure the FastAPI application instance."""

    settings = get_settings()
    telemetry_settings = get_telemetry_settings()
    configure_telemetry(telemetry_settings)

    application = FastAPI(title=settings.title, version=settings.version)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(health_router)
    if settings.nostr_enabled:
        application.include_router(auth_router)
    application.include_router(admin_router)
    application.include_router(admin_refunds_router)
    application.include_router(admin_stats_router)
    application.include_router(developers_router)
    application.include_router(users_router)
    application.include_router(games_router)
    application.include_router(comments_router)
    application.include_router(reviews_router)
    application.include_router(purchases_router)
    if settings.nostr_enabled:
        application.include_router(nostr_router)
    application.include_router(zaps_router)
    return application


app = create_application()
