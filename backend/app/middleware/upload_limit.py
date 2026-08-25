from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class UploadLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests whose declared content length exceeds the upload limit."""

    def __init__(self, app, max_upload_bytes: int) -> None:
        """Initialize middleware with the maximum accepted request size."""
        super().__init__(app)
        self.max_upload_bytes = max_upload_bytes

    async def dispatch(self, request: Request, call_next):
        """Return HTTP 413 for oversized requests before parsing their body."""
        content_length = request.headers.get("content-length")
        if (
            content_length
            and content_length.isdigit()
            and int(content_length) > self.max_upload_bytes
        ):
            return JSONResponse(
                status_code=413,
                content={
                    "error": "payload_too_large",
                    "max_upload_bytes": self.max_upload_bytes,
                },
            )

        return await call_next(request)
