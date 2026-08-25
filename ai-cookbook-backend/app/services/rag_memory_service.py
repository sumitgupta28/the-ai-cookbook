from sqlalchemy.orm import Session

from app.config import Settings
from app.repositories.conversation_repository import ConversationRepository
from app.services.rag_service import RagContext, RagService


class RagMemoryService:
    """Coordinate RAG retrieval with conversation summaries and message history."""

    def __init__(self, session: Session, settings: Settings) -> None:
        """Initialize conversation and RAG service dependencies."""
        self.conversation_repository = ConversationRepository(session)
        self.rag_service = RagService(session, settings)

    def build_rag_context(
        self,
        user_message: str,
        top_k: int | None = None,
        similarity_threshold: float | None = None,
        mode: str | None = None,
    ) -> RagContext:
        """Delegate context construction to the shared RAG service."""
        return self.rag_service.build_rag_context(
            user_message=user_message,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
            mode=mode,
        )

    def clear_conversation(self, conversation_id: str) -> int:
        """Delete all messages associated with a conversation identifier."""
        return self.conversation_repository.delete_by_conversation_id(conversation_id)

    def list_conversations(self):
        """Return conversation summaries ordered by recent activity."""
        return self.conversation_repository.find_conversation_summaries()

    def get_conversation_messages(self, conversation_id: str):
        """Return messages for a conversation in message-index order."""
        return self.conversation_repository.find_by_conversation_id_ordered(conversation_id)
