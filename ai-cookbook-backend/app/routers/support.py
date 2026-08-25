from __future__ import annotations

import logging
import math
import re
from datetime import UTC, datetime

from fastapi import Request
from fastapi.responses import StreamingResponse

from app.models.conversation_message import ConversationMessage
from app.providers.base import ChatProvider

logger = logging.getLogger(__name__)


def get_chat_provider(request: Request) -> ChatProvider:
    """Return the provider initialized during application startup."""
    return request.app.state.chat_provider


async def generate_chat_text(
    provider: ChatProvider,
    message: str,
    system_prompt: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    """Generate text through the configured provider with optional overrides."""
    return await provider.generate_text(
        message=message,
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def stream_text(text: str, chunk_size: int = 24):
    """Yield response text as newline-delimited server-sent events."""
    for index in range(0, len(text or ""), chunk_size):
        chunk = (text or "")[index : index + chunk_size]
        lines = chunk.splitlines() or [""]
        yield "".join(f"data:{line}\n" for line in lines) + "\n"


def sse_response(text: str) -> StreamingResponse:
    """Create an SSE response for a complete text answer."""
    return StreamingResponse(stream_text(text), media_type="text/event-stream")


def memory_window(messages: list[ConversationMessage], max_size: int = 20):
    """Return only the most recent messages allowed by the memory window."""
    return messages[-max_size:] if len(messages) > max_size else messages


def serialize_conversation_summary(row) -> dict:
    """Convert a conversation summary row to the frontend JSON shape."""
    return {
        "conversationId": row.conversation_id,
        "startedAt": row.started_at,
        "lastActivity": row.last_activity,
        "messageCount": row.message_count,
        "preview": row.preview,
    }


def serialize_conversation_message(row: ConversationMessage) -> dict:
    """Convert a conversation message model to the frontend JSON shape."""
    return {
        "id": row.id,
        "conversationId": row.conversation_id,
        "messageIndex": row.message_index,
        "role": row.role,
        "content": row.content,
        "createdAt": row.created_at,
    }


def serialize_document(row) -> dict:
    """Convert document metadata to camel-case API fields."""
    return {
        "id": row.id,
        "filename": row.filename,
        "contentType": row.content_type,
        "fileSize": row.file_size,
        "uploadTime": row.upload_time,
        "chunkCount": row.chunk_count,
    }


def serialize_product(row) -> dict:
    """Convert a product model to the frontend JSON shape."""
    return {
        "id": row.id,
        "productId": row.product_id,
        "name": row.name,
        "category": row.category,
        "brand": row.brand,
        "description": row.description,
        "price": float(row.price),
        "imageUrl": row.image_url,
        "rating": float(row.rating) if row.rating is not None else None,
        "stockCount": row.stock_count,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


def extract_entities(text: str) -> dict[str, list[str]]:
    """Extract the supported entity categories using lightweight heuristics."""
    people = sorted(set(re.findall(r"\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b", text)))
    organizations = sorted(
        set(
            re.findall(
                r"\b([A-Z][A-Za-z0-9&\-. ]+"
                r"(?:Inc|Corp|Corporation|LLC|Ltd|University|NASA|Microsoft|Apple|Google|OpenAI))\b",
                text,
            )
        )
    )
    locations = sorted(
        set(
            re.findall(
                r"\b(?:in|at|from|to)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)",
                text,
            )
        )
    )
    dates = sorted(
        set(
            re.findall(
                r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+"
                r"\d{1,2},\s+\d{4}\b|\b\d{4}\b",
                text,
            )
        )
    )
    words = re.findall(r"\b[a-zA-Z]{5,}\b", text.lower())
    ignored = {"about", "which", "there", "their", "would", "could", "should", "where"}
    counts: dict[str, int] = {}
    for word in words:
        if word not in ignored:
            counts[word] = counts.get(word, 0) + 1
    topics = [
        word for word, _ in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:8]
    ]
    return {
        "people": people,
        "organizations": organizations,
        "locations": locations,
        "dates": dates,
        "topics": topics,
    }


def tool_response(message: str) -> str | None:
    """Handle deterministic calculator, weather, and date tool requests."""
    lower = message.lower()
    if "weather" in lower:
        city_match = re.search(r"in\s+([a-zA-Z\s]+)\??$", message.strip())
        city = city_match.group(1).strip() if city_match else "your location"
        weather = {
            "tokyo": (30, "Sunny"),
            "london": (19, "Cloudy"),
            "paris": (23, "Partly cloudy"),
            "new york": (27, "Humid"),
            "san francisco": (18, "Foggy"),
            "berlin": (21, "Windy"),
            "sydney": (16, "Clear"),
        }.get(city.lower(), (24, "Moderate"))
        return f"Weather in {city}: {weather[1]}, {weather[0]}C."

    if "date" in lower or "time" in lower or "day" in lower:
        return (
            datetime.now(UTC).astimezone().strftime("Current local date/time: %Y-%m-%d %H:%M:%S %Z")
        )

    numbers = [float(number) for number in re.findall(r"-?\d+(?:\.\d+)?", lower)]
    if len(numbers) >= 2:
        first, second = numbers[:2]
        if "plus" in lower or "add" in lower:
            return str(first + second)
        if "minus" in lower or "subtract" in lower:
            return str(first - second)
        if "multipl" in lower or "times" in lower or " x " in f" {lower} ":
            return str(first * second)
        if "divide" in lower or "quotient" in lower or "/" in lower:
            return "Cannot divide by zero." if math.isclose(second, 0.0) else str(first / second)
    return None
