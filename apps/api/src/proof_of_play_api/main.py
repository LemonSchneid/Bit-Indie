"""Application factory for the Proof of Play FastAPI service."""

from fastapi import FastAPI

from proof_of_play_api.api.v1.routes.health import router as health_router


def create_application() -> FastAPI:
    """Build and configure the FastAPI application instance."""

    application = FastAPI(title="Proof of Play API", version="0.1.0")
    application.include_router(health_router)
    return application


app = create_application()
