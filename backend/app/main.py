from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import check_database_connection, check_pgvector_extension
from app.middleware.upload_limit import UploadLimitMiddleware
from app.providers.factory import build_chat_provider
from app.routers.chat import router as chat_router
from app.routers.chunking import router as chunking_router
from app.routers.documents import router as documents_router
from app.routers.memory import router as memory_router
from app.routers.products import router as products_router
from app.routers.rag import router as rag_router
from app.routers.structured import router as structured_router
from app.routers.system import router as system_router
from app.routers.tools import router as tools_router

settings = get_settings()


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Run startup dependency checks and expose their state to readiness probes."""
    startup_checks = {
        "database": False,
        "pgvector_extension": False,
        "chat_provider": False,
    }

    try:
        check_database_connection()
        startup_checks["database"] = True

        check_pgvector_extension()
        startup_checks["pgvector_extension"] = True

        application.state.chat_provider = build_chat_provider(settings)
        startup_checks["chat_provider"] = True
    except Exception as exc:
        application.state.startup_error = str(exc)

    application.state.startup_checks = startup_checks
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Python backend foundation for Spring Boot migration",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

app.add_middleware(UploadLimitMiddleware, max_upload_bytes=settings.upload_max_bytes)

app.include_router(system_router)
app.include_router(chat_router)
app.include_router(rag_router)
app.include_router(memory_router)
app.include_router(documents_router)
app.include_router(products_router)
app.include_router(tools_router)
app.include_router(structured_router)
app.include_router(chunking_router)
