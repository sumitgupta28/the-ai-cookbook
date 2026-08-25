from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    """Base API model enabling ORM conversion and camel-case aliases."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class RagContextResponse(ApiModel):
    """Response containing assembled RAG prompt and source metadata."""

    system_prompt: str | None = Field(alias="systemPrompt")
    short_circuit: bool = Field(alias="shortCircuit")
    short_circuit_message: str | None = Field(alias="shortCircuitMessage")
    sources: list[str]


class SearchResultResponse(ApiModel):
    """One document similarity-search result."""

    filename: str
    similarity: float
    content_preview: str = Field(alias="contentPreview")


class DeleteResponse(ApiModel):
    """Common response returned after a successful deletion."""

    deleted: bool


class ProductUploadResponse(ApiModel):
    """Counts and row-level errors produced by product import."""

    imported: int
    skipped: int
    errors: list[str]


class RagChatResponse(ApiModel):
    """JSON response for a conversation-scoped RAG request."""

    answer: str
    conversation_id: str = Field(alias="conversationId")
    rag_context_used: bool = Field(alias="ragContextUsed")
    mode: str
    sources: list[str]


class EntityExtractionResponse(ApiModel):
    """Structured entity categories returned by extraction."""

    people: list[str]
    organizations: list[str]
    locations: list[str]
    dates: list[str]
    topics: list[str]
