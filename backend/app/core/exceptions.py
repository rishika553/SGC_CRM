import logging
from typing import Any, Dict, Optional
from fastapi import HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

logger = logging.getLogger("app.exceptions")


class CRMException(HTTPException):
    def __init__(
        self,
        status_code: int,
        detail: str,
        code: str = "INTERNAL_ERROR",
        extra: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.code = code
        self.extra = extra or {}


class NotFoundException(CRMException):
    def __init__(self, detail: str = "Requested resource not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            code="RESOURCE_NOT_FOUND",
        )


class UnauthorizedException(CRMException):
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            code="UNAUTHORIZED",
        )


class ForbiddenException(CRMException):
    def __init__(self, detail: str = "Not enough permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            code="FORBIDDEN",
        )


class ConflictException(CRMException):
    def __init__(self, detail: str = "Resource conflict detected"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            code="RESOURCE_CONFLICT",
        )


async def crm_exception_handler(request: Request, exc: CRMException) -> JSONResponse:
    logger.warning(f"CRMException [{exc.code}] {exc.status_code} at {request.url.path}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.detail,
                "extra": exc.extra,
            },
            "path": request.url.path,
        },
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = []
    for err in exc.errors():
        field = ".".join([str(loc) for loc in err.get("loc", [])])
        errors.append({"field": field, "message": err.get("msg")})

    logger.warning(f"Validation Error at {request.url.path}: {errors}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Input validation failed",
                "details": errors,
            },
            "path": request.url.path,
        },
    )


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    print(f"[UNHANDLED_EXCEPTION] {request.url.path}: {exc}", flush=True)
    import traceback
    traceback.print_exc()
    logger.error(f"Unhandled Server Exception at {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred on the server.",
            },
            "path": request.url.path,
        },
    )
