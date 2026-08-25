from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document_metadata import DocumentMetadata


class DocumentMetadataRepository:
    """Persist document metadata while vector chunks remain in pgvector."""

    def __init__(self, session: Session) -> None:
        """Bind repository operations to a caller-managed SQLAlchemy session."""
        self.session = session

    def create(self, entity: DocumentMetadata) -> DocumentMetadata:
        """Stage and flush a new document metadata record."""
        self.session.add(entity)
        self.session.flush()
        return entity

    def find_all_order_by_upload_time_desc(self) -> list[DocumentMetadata]:
        """Return document metadata from newest upload to oldest."""
        stmt = select(DocumentMetadata).order_by(DocumentMetadata.upload_time.desc())
        return list(self.session.scalars(stmt).all())

    def delete_by_id(self, document_id: int) -> bool:
        """Mark a document metadata record for deletion when it exists."""
        entity = self.session.get(DocumentMetadata, document_id)
        if not entity:
            return False
        self.session.delete(entity)
        return True
