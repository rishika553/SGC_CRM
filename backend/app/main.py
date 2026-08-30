from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware

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
    if settings.RUN_STARTUP_MIGRATIONS:
        print("[STARTUP] RUN_STARTUP_MIGRATIONS is enabled. This may slow down cold starts.")

    if settings.SEED_ROLES_ON_STARTUP:
        # Keep lightweight role seeding available for fresh environments without
        # blocking every deployment on a full migration subprocess.
        try:
            from app.core.database import AsyncSessionLocal
            from sqlalchemy.future import select
            from app.models.role import Role, UserRoleEnum
            async with AsyncSessionLocal() as db:
                for role_name, display, desc in [
                    (UserRoleEnum.SUPER_ADMIN, "Super Administrator", "Full system administration and global access"),
                    (UserRoleEnum.CLIENT, "Client", "Client portal access"),
                ]:
                    res = await db.execute(select(Role).where(Role.name == role_name))
                    if not res.scalar_one_or_none():
                        db.add(Role(name=role_name, display_name=display, description=desc))
                await db.commit()
            print("[STARTUP] Roles seeded")
        except Exception as e:
            print(f"[STARTUP] Role seeding skipped/failed: {e}")

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

    # Prevent browsers from caching API responses (protects after logout).
    class NoCacheMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            response = await call_next(request)
            if request.url.path.startswith("/api/"):
                response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
                response.headers["Pragma"] = "no-cache"
            return response

    application.add_middleware(NoCacheMiddleware)

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

    @application.get("/debug/db")
    async def debug_db():
        """Unauthenticated diagnostic — remove after debugging."""
        from sqlalchemy import text
        from app.core.database import AsyncSessionLocal
        info = {"db_url": settings.DATABASE_URL[:40] + "..."}
        try:
            async with AsyncSessionLocal() as db:
                # Check tables
                res = await db.execute(text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public' ORDER BY table_name"
                ))
                info["public_tables"] = [r[0] for r in res.fetchall()]

                # Count roles
                try:
                    res = await db.execute(text("SELECT COUNT(*) FROM roles"))
                    info["roles_count"] = res.scalar()
                except Exception as e:
                    info["roles_error"] = str(e)

                # Count users (including soft-deleted)
                try:
                    res = await db.execute(text("SELECT COUNT(*) FROM users"))
                    info["users_count"] = res.scalar()
                    res2 = await db.execute(text("SELECT id, email, is_deleted FROM users"))
                    info["users"] = [{"id": str(r[0]), "email": r[1], "is_deleted": r[2]} for r in res2.fetchall()]
                except Exception as e:
                    info["users_error"] = str(e)
        except Exception as e:
            info["db_error"] = str(e)
        return info

    return application


app = create_application()
