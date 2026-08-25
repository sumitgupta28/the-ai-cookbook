from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models.conversation_message import ConversationMessage
from app.providers.base import ChatProvider
from app.repositories.conversation_repository import ConversationRepository
from app.routers.support import (
    generate_chat_text,
    get_chat_provider,
    memory_window,
    serialize_conversation_message,
    serialize_conversation_summary,
    stream_text,
)
from app.schemas import (
    ConversationMessageRead,
    ConversationSummaryRead,
    DeleteResponse,
    RagChatResponse,
)
from app.services import RagMemoryService

router = APIRouter(prefix="/rag/memory", tags=["rag-memory"])


async def build_memory_answer(
    provider: ChatProvider,
    service: RagMemoryService,
    repository: ConversationRepository,
    conversation_id: str,
    message: str,
    top_k: int,
    threshold: float,
    mode: str,
    temperature: float,
    max_tokens: int,
):
    """Build one RAG answer using the conversation's recent message window."""
    prior = repository.find_by_conversation_id_ordered(conversation_id)
    history = "\n".join(f"{item.role}: {item.content}" for item in memory_window(prior))
    context = service.build_rag_context(message, top_k, threshold, mode)
    if context.short_circuit:
        answer = context.short_circuit_message or "No relevant context found."
    else:
        prefix = f"Conversation history:\n{history}\n\n" if history else ""
        answer = await generate_chat_text(
            provider,
            f"{prefix}Current user message:\n{message}",
            context.system_prompt,
            temperature,
            max_tokens,
        )
    return answer, context, prior


def save_memory_turn(repository, conversation_id, prior, message, answer):
    """Persist the user and assistant messages as one conversation turn."""
    index = len(prior)
    repository.create_message(
        ConversationMessage(
            conversation_id=conversation_id, message_index=index, role="USER", content=message
        )
    )
    repository.create_message(
        ConversationMessage(
            conversation_id=conversation_id,
            message_index=index + 1,
            role="ASSISTANT",
            content=answer,
        )
    )


@router.get("/ai/chat/string/client")
async def rag_memory_chat_string_client(
    message: str,
    conversationId: str,
    topK: int = Query(default=5, ge=1, le=50),
    similarityThreshold: float = Query(default=0.0, ge=0.0, le=1.0),
    mode: str = Query(default="soft"),
    temperature: float = Query(default=0.7, ge=0.0, le=1.0),
    maxTokens: int = Query(default=1000, ge=64, le=4096),
    session: Session = Depends(get_db),
    provider: ChatProvider = Depends(get_chat_provider),
):
    """Stream a RAG answer while retaining the conversation history."""
    repository = ConversationRepository(session)
    answer, _, prior = await build_memory_answer(
        provider,
        RagMemoryService(session, get_settings()),
        repository,
        conversationId,
        message,
        topK,
        similarityThreshold,
        mode,
        temperature,
        maxTokens,
    )
    save_memory_turn(repository, conversationId, prior, message, answer)
    return StreamingResponse(stream_text(answer), media_type="text/event-stream")


@router.post("/ai/chat/json/client", response_model=RagChatResponse)
async def rag_memory_chat_json_client(
    payload: dict,
    session: Session = Depends(get_db),
    provider: ChatProvider = Depends(get_chat_provider),
):
    """Return a typed RAG-memory answer with sources and conversation metadata."""
    message = str(payload.get("message", "")).strip()
    conversation_id = str(payload.get("conversationId", "")).strip()
    if not message or not conversation_id:
        raise HTTPException(status_code=400, detail="message and conversationId are required")
    repository = ConversationRepository(session)
    answer, context, prior = await build_memory_answer(
        provider,
        RagMemoryService(session, get_settings()),
        repository,
        conversation_id,
        message,
        int(payload.get("topK", 5)),
        float(payload.get("similarityThreshold", 0.0)),
        str(payload.get("mode", "soft")),
        float(payload.get("temperature", 0.7)),
        int(payload.get("maxTokens", 1000)),
    )
    save_memory_turn(repository, conversation_id, prior, message, answer)
    return {
        "answer": answer,
        "conversationId": conversation_id,
        "ragContextUsed": bool(context.system_prompt),
        "mode": str(payload.get("mode", "soft")),
        "sources": context.sources,
    }


@router.delete("/ai/chat/conversation/{conversation_id}", response_model=DeleteResponse)
def delete_rag_memory_conversation(conversation_id: str, session: Session = Depends(get_db)):
    """Delete all stored messages for a conversation."""
    return {
        "deleted": RagMemoryService(session, get_settings()).clear_conversation(conversation_id) > 0
    }


@router.get("/conversations", response_model=list[ConversationSummaryRead])
def list_rag_memory_conversations(session: Session = Depends(get_db)):
    """List saved conversations ordered by recent activity."""
    return [
        serialize_conversation_summary(row)
        for row in RagMemoryService(session, get_settings()).list_conversations()
    ]


@router.get(
    "/conversations/{conversation_id}/messages", response_model=list[ConversationMessageRead]
)
def list_rag_memory_messages(conversation_id: str, session: Session = Depends(get_db)):
    """Return ordered messages for a saved conversation."""
    return [
        serialize_conversation_message(row)
        for row in RagMemoryService(session, get_settings()).get_conversation_messages(
            conversation_id
        )
    ]
