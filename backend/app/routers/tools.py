from fastapi import APIRouter, Depends, HTTPException

from app.providers.base import ChatProvider
from app.routers.support import generate_chat_text, get_chat_provider, tool_response

router = APIRouter(prefix="/tool", tags=["tools"])


@router.get("/ai/chat/string")
async def tool_chat_string(
    message: str,
    provider: ChatProvider = Depends(get_chat_provider),
):
    """Answer a tool-oriented request using deterministic tools or the provider."""
    quick_response = tool_response(message)
    if quick_response is not None:
        return quick_response
    try:
        return await generate_chat_text(provider, message)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
