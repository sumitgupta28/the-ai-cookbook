from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import Settings
from app.services.embedding_service import EmbeddingService
from app.vector.vector_store_adapter import VectorStoreAdapter


@dataclass
class SearchResult:
    """Public document search result with derived similarity score."""

    filename: str
    similarity: float
    content_preview: str


@dataclass
class RagContext:
    """Prompt context and control flags produced by RAG retrieval."""

    system_prompt: str | None
    short_circuit: bool
    short_circuit_message: str | None
    sources: list[str]


class RagService:
    """Retrieve document chunks and assemble strict or soft RAG context."""

    def __init__(self, session: Session, settings: Settings) -> None:
        """Create a RAG service backed by one database session and settings object."""
        self.settings = settings
        self.embeddings = EmbeddingService(settings)
        self.vector_store = VectorStoreAdapter(session)

    def search_documents(
        self,
        query: str,
        top_k: int | None = None,
        similarity_threshold: float | None = None,
    ) -> list[SearchResult]:
        """Search document vectors and convert distance values to similarities."""
        top_k = top_k if top_k is not None else self.settings.rag_top_k
        similarity_threshold = (
            similarity_threshold
            if similarity_threshold is not None
            else self.settings.rag_similarity_threshold
        )

        embedding = self.embeddings.embed(query)
        max_distance = self.vector_store.max_distance_from_similarity_threshold(
            similarity_threshold
        )
        hits = self.vector_store.search_document_vectors(
            embedding, top_k=top_k, max_distance=max_distance
        )

        return [
            SearchResult(
                filename=str(hit.metadata.get("filename", "unknown")),
                similarity=hit.similarity,
                content_preview=(hit.content or "")[:200],
            )
            for hit in hits
        ]

    def build_rag_context(
        self,
        user_message: str,
        top_k: int | None = None,
        similarity_threshold: float | None = None,
        mode: str | None = None,
    ) -> RagContext:
        """Build a prompt from search results, including strict-mode short circuits."""
        mode = (mode or self.settings.rag_mode).lower()
        results = self.search_documents(
            query=user_message,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
        )

        if not results and mode == "strict":
            return RagContext(
                system_prompt=None,
                short_circuit=True,
                short_circuit_message=(
                    "No relevant information found in indexed documents for strict mode."
                ),
                sources=[],
            )

        if not results and mode != "strict":
            return RagContext(
                system_prompt=None,
                short_circuit=False,
                short_circuit_message=None,
                sources=[],
            )

        sources = sorted({result.filename for result in results})
        context_chunks = [result.content_preview for result in results if result.content_preview]
        context_text = "\n\n---\n\n".join(context_chunks)

        if mode == "strict":
            prompt = (
                "You must answer ONLY using the provided document context. "
                "If context does not contain the answer, say so clearly.\n\n"
                f"Context:\n{context_text}"
            )
        else:
            prompt = (
                "Use document context first. If insufficient, you may provide a "
                "best-effort answer.\n\n"
                f"Context:\n{context_text}"
            )

        return RagContext(
            system_prompt=prompt,
            short_circuit=False,
            short_circuit_message=None,
            sources=sources,
        )
