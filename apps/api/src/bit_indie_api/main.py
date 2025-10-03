"""Application factory for the Bit Indie FastAPI service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from bit_indie_api.api.v1.routes.admin import router as admin_router
from bit_indie_api.api.v1.routes.admin_refunds import router as admin_refunds_router
from bit_indie_api.api.v1.routes.admin_stats import router as admin_stats_router
from bit_indie_api.api.v1.routes.auth import router as auth_router
from bit_indie_api.api.v1.routes.comments import router as comments_router
from bit_indie_api.api.v1.routes.developers import router as developers_router
from bit_indie_api.api.v1.routes.game_catalog import router as game_catalog_router
from bit_indie_api.api.v1.routes.game_drafts import router as game_drafts_router
from bit_indie_api.api.v1.routes.game_purchases import router as game_purchases_router
from bit_indie_api.api.v1.routes.health import router as health_router
from bit_indie_api.api.v1.routes.moderation_flags import router as moderation_flags_router
from bit_indie_api.api.v1.routes.purchases import router as purchases_router
from bit_indie_api.api.v1.routes.reviews import router as reviews_router
from bit_indie_api.api.v1.routes.users import router as users_router
from bit_indie_api.core.config import get_settings
from bit_indie_api.core.logging import (
    RequestContextMiddleware,
    RequestLoggingMiddleware,
    configure_logging,
    get_logging_settings,
)
from bit_indie_api.core.telemetry import (
    configure_telemetry,
    get_telemetry_settings,
)


def create_application() -> FastAPI:
    """Build and configure the FastAPI application instance."""

    logging_settings = get_logging_settings()
    configure_logging(logging_settings)
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
    application.add_middleware(RequestLoggingMiddleware)
    application.add_middleware(
        RequestContextMiddleware,
        header_name=logging_settings.request_id_header,
    )
    application.include_router(auth_router)
    application.include_router(health_router)
    application.include_router(admin_router)
    application.include_router(admin_refunds_router)
    application.include_router(admin_stats_router)
    application.include_router(developers_router)
    application.include_router(users_router)
    application.include_router(game_catalog_router)
    application.include_router(game_drafts_router)
    application.include_router(game_purchases_router)
    application.include_router(comments_router)
    application.include_router(reviews_router)
    application.include_router(moderation_flags_router)
    application.include_router(purchases_router)
    return application


app = create_application()
