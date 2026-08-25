from sqlalchemy.orm import Session

from app.repositories.conversation_repository import ConversationRepository
from app.repositories.document_metadata_repository import DocumentMetadataRepository
from app.repositories.product_repository import ProductRepository


class DocumentPersistenceService:
    """Provide document metadata queries to persistence-focused API routes."""

    def __init__(self, session: Session) -> None:
        """Create the document repository facade."""
        self.repository = DocumentMetadataRepository(session)

    def list_documents(self):
        """Return document metadata ordered by upload time."""
        return self.repository.find_all_order_by_upload_time_desc()


class ProductPersistenceService:
    """Provide product catalog queries to persistence-focused API routes."""

    def __init__(self, session: Session) -> None:
        """Create the product repository facade."""
        self.repository = ProductRepository(session)

    def list_products(self):
        """Return products ordered by creation time."""
        return self.repository.find_all_order_by_created_at_desc()


class ConversationPersistenceService:
    """Provide conversation query operations to persistence-focused API routes."""

    def __init__(self, session: Session) -> None:
        """Create the conversation repository facade."""
        self.repository = ConversationRepository(session)

    def list_conversation_summaries(self):
        """Return aggregated summaries for stored conversations."""
        return self.repository.find_conversation_summaries()

    def get_conversation_messages(self, conversation_id: str):
        """Return ordered messages for one conversation."""
        return self.repository.find_by_conversation_id_ordered(conversation_id)
