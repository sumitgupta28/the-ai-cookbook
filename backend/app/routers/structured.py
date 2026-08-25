import json
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.providers.base import ChatProvider
from app.routers.support import extract_entities, generate_chat_text, get_chat_provider
from app.schemas import EntityExtractionResponse

router = APIRouter(prefix="/structured", tags=["structured-output"])
logger = logging.getLogger(__name__)


@router.get("/extract", response_model=EntityExtractionResponse)
async def structured_extract(
    message: str,
    provider: ChatProvider = Depends(get_chat_provider),
):
    """Extract people, organizations, locations, dates, and topics as JSON."""
    extracted = extract_entities(message)
    if any(extracted.values()):
        return extracted
    try:
        response = await generate_chat_text(
            provider,
            message,
            system_prompt=(
                "Return only JSON with keys people, organizations, locations, dates, topics."
            ),
        )
        parsed = json.loads(response)
    except Exception as exc:
        logger.exception("Structured extraction failed")
        raise HTTPException(status_code=502, detail="Structured extraction failed") from exc
    return {
        key: list(parsed.get(key, []))
        for key in ("people", "organizations", "locations", "dates", "topics")
    }
