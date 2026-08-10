from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.exceptions import (
    CRMException,
    crm_exception_handler,
    validation_exception_handler,
    global_exception_handler,
)
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks (e.g. connection pool initialization)
    print(f"Starting {settings.PROJECT_NAME} backend service...")
    yield
    # Shutdown tasks
    print(f"Shutting down {settings.PROJECT_NAME} backend service...")


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version="1.0.0",
        description="Production-grade API for Consulting Firm CRM Platform",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
        redoc_url=f"{settings.API_V1_STR}/redoc",
        lifespan=lifespan,
    )

    # CORS Middleware Setup
    
    print("CORS ORIGINS:", settings.CORS_ORIGINS)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.add_exception_handler(
        CRMException,
        crm_exception_handler
    )

    application.add_exception_handler(
        RequestValidationError,
        validation_exception_handler
    )

    application.add_exception_handler(
        Exception,
        global_exception_handler
    )

    application.include_router(
        api_router,
        prefix=settings.API_V1_STR
    )

    # Public (unauthenticated) endpoints for Render health checks / root probes
    @application.get("/")
    async def root():
        return {
            "status": "ok",
            "service": settings.PROJECT_NAME
        }

    @application.get("/health")
    async def health():
        return {
            "status": "healthy"
        }

    return application


app = create_application()