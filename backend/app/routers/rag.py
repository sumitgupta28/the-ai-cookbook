from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.providers.base import ChatProvider
from app.routers.support import generate_chat_text, get_chat_provider, stream_text
from app.schemas import RagContextResponse, SearchResultResponse
from app.services import RagService

router = APIRouter(tags=["rag"])


@router.get("/rag/context", response_model=RagContextResponse)
def rag_context(
    message: str,
    topK: int = Query(default=5, ge=1, le=50),
    similarityThreshold: float = Query(default=0.0, ge=0.0, le=1.0),
    mode: str = Query(default="soft"),
    session: Session = Depends(get_db),
):
    """Build document context and report strict-mode short-circuit state."""
    service = RagService(session, get_settings())
    context = service.build_rag_context(
        user_message=message,
        top_k=topK,
        similarity_threshold=similarityThreshold,
        mode=mode,
    )
    return {
        "systemPrompt": context.system_prompt,
        "shortCircuit": context.short_circuit,
        "shortCircuitMessage": context.short_circuit_message,
        "sources": context.sources,
    }


@router.get("/rag/search", response_model=list[SearchResultResponse])
def rag_search(
    query: str,
    topK: int = Query(default=5, ge=1, le=50),
    similarityThreshold: float = Query(default=0.0, ge=0.0, le=1.0),
    session: Session = Depends(get_db),
):
    """Search indexed document chunks by vector similarity."""
    service = RagService(session, get_settings())
    results = service.search_documents(
        query,
        top_k=topK,
        similarity_threshold=similarityThreshold,
    )
    return [
        {
            "filename": result.filename,
            "similarity": result.similarity,
            "contentPreview": result.content_preview,
        }
        for result in results
    ]


@router.get("/rag/ai/chat/string/client", response_class=StreamingResponse)
async def rag_chat_string_client(
    message: str,
    topK: int = Query(default=5, ge=1, le=50),
    similarityThreshold: float = Query(default=0.0, ge=0.0, le=1.0),
    mode: str = Query(default="soft"),
    temperature: float = Query(default=0.7, ge=0.0, le=1.0),
    maxTokens: int = Query(default=1000, ge=64, le=4096),
    session: Session = Depends(get_db),
    provider: ChatProvider = Depends(get_chat_provider),
):
    """Stream an answer augmented with retrieved document context."""
    service = RagService(session, get_settings())
    context = service.build_rag_context(message, topK, similarityThreshold, mode)
    if context.short_circuit:
        return StreamingResponse(
            stream_text(context.short_circuit_message or "No relevant context found."),
            media_type="text/event-stream",
        )
    try:
        answer = await generate_chat_text(
            provider, message, context.system_prompt, temperature, maxTokens
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return StreamingResponse(stream_text(answer), media_type="text/event-stream")
