from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.providers.base import ChatProvider
from app.routers.support import generate_chat_text, get_chat_provider, stream_text

router = APIRouter(tags=["chat"])


@router.get("/ai/chat/string", response_class=StreamingResponse)
async def chat_string(
    message: str,
    provider: ChatProvider = Depends(get_chat_provider),
):
    """Stream a provider response for direct chat without document context."""
    try:
        answer = await generate_chat_text(provider, message)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return StreamingResponse(stream_text(answer), media_type="text/event-stream")
