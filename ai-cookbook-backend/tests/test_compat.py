import pytest
from pydantic import ValidationError

from app.config import Settings
from app.routers.support import extract_entities, generate_chat_text, stream_text, tool_response
from app.services.embedding_service import EmbeddingService
from app.services.ingestion_service import IngestionService


def test_sse_encoding_preserves_multiline_data():
    assert next(stream_text("first\nsecond")) == "data:first\ndata:second\n\n"


def test_tool_response_handles_calculator_operations():
    assert tool_response("What is 237 plus 489?") == "726.0"
    assert tool_response("What is 42 multiplied by 17?") == "714.0"
    assert tool_response("Divide 144 by 12.") == "12.0"
    assert tool_response("Divide 10 by 0.") == "Cannot divide by zero."


def test_tool_response_handles_weather_and_date_requests():
    weather = tool_response("What's the weather like in Tokyo?")
    assert weather == "Weather in Tokyo: Sunny, 30C."

    date_response = tool_response("What day is it today?")
    assert date_response.startswith("Current local date/time: ")


def test_entity_extraction_returns_expected_schema_values():
    result = extract_entities(
        "Apple was founded by Steve Jobs in Cupertino, California on April 1, 1976."
    )

    assert set(result) == {"people", "organizations", "locations", "dates", "topics"}
    assert "Steve Jobs" in result["people"]
    assert "April 1, 1976" in result["dates"]
    assert "Cupertino" in result["locations"]


@pytest.mark.asyncio
async def test_chat_generation_forwards_request_controls():
    class FakeProvider:
        async def generate_text(self, **kwargs):
            self.arguments = kwargs
            return "answer"

    provider = FakeProvider()
    result = await generate_chat_text(
        provider,
        "question",
        system_prompt="context",
        temperature=0.2,
        max_tokens=250,
    )

    assert result == "answer"
    assert provider.arguments["temperature"] == 0.2
    assert provider.arguments["max_tokens"] == 250


def test_embedding_is_deterministic_and_normalized():
    service = EmbeddingService(Settings(embedding_dimensions=8))
    first = service.embed("same text")
    second = service.embed("same text")

    assert first == second
    assert len(first) == 8
    assert sum(value * value for value in first) == pytest.approx(1.0)


def test_ingestion_adapts_chunk_size_to_document_length():
    service = IngestionService(session=None, settings=Settings())

    tiny_chunks = service._chunk_text("word " * 100)
    large_chunks = service._chunk_text("word " * 1000)

    assert len(tiny_chunks) >= 2
    assert len(large_chunks) >= 3
    assert len(tiny_chunks[0]) < len(large_chunks[0])


def test_settings_reject_unsupported_chat_provider():
    with pytest.raises(ValidationError):
        Settings(AI_CHAT_PROVIDER="ollama")
