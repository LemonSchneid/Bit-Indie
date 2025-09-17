"""Application factory for the Proof of Play FastAPI service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from proof_of_play_api.api.v1.routes.auth import router as auth_router
from proof_of_play_api.api.v1.routes.developers import router as developers_router
from proof_of_play_api.api.v1.routes.games import router as games_router
from proof_of_play_api.api.v1.routes.health import router as health_router
from proof_of_play_api.api.v1.routes.purchases import router as purchases_router
from proof_of_play_api.core.config import get_settings


def create_application() -> FastAPI:
    """Build and configure the FastAPI application instance."""

    settings = get_settings()
    application = FastAPI(title=settings.title, version=settings.version)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(health_router)
    application.include_router(auth_router)
    application.include_router(developers_router)
    application.include_router(games_router)
    application.include_router(purchases_router)
    return application


app = create_application()
