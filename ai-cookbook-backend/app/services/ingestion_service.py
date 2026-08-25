from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path

from docx import Document as DocxDocument
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.document_metadata import DocumentMetadata
from app.repositories.document_metadata_repository import DocumentMetadataRepository
from app.services.embedding_service import EmbeddingService
from app.vector.vector_store_adapter import VectorStoreAdapter


class IngestionService:
    """Parse, adaptively chunk, embed, and persist uploaded documents."""

    def __init__(self, session: Session, settings: Settings) -> None:
        """Initialize document repositories and the configured embedding adapter."""
        self.settings = settings
        self.session = session
        self.repository = DocumentMetadataRepository(session)
        self.embeddings = EmbeddingService(settings)
        self.vector_store = VectorStoreAdapter(session)

    def ingest_document(
        self, filename: str, content_type: str | None, payload: bytes
    ) -> DocumentMetadata:
        """Index a supported document and persist its metadata and vector chunks."""
        text = self.extract_text(filename, payload)
        chunks = self._chunk_text(text)

        metadata = DocumentMetadata(
            filename=filename,
            content_type=content_type,
            file_size=len(payload),
            upload_time=datetime.now(UTC),
            chunk_count=len(chunks),
        )
        self.repository.create(metadata)

        for index, chunk in enumerate(chunks):
            embedding = self.embeddings.embed(chunk)
            self.vector_store.add_document_vector(
                content=chunk,
                metadata={"filename": filename, "chunk_index": index},
                embedding=embedding,
            )

        return metadata

    def delete_document(self, document_id: int) -> bool:
        """Delete document metadata and all vectors associated with its filename."""
        entity = self.session.get(DocumentMetadata, document_id)
        if not entity:
            return False

        self.vector_store.delete_document_vectors_by_filename(entity.filename)
        self.repository.delete_by_id(document_id)
        return True

    def extract_text(self, filename: str, payload: bytes) -> str:
        """Extract text from TXT, PDF, or DOCX content based on its extension."""
        suffix = Path(filename).suffix.lower()
        if suffix == ".txt":
            return payload.decode("utf-8", errors="ignore")

        if suffix == ".pdf":
            reader = PdfReader(BytesIO(payload))
            return "\n".join((page.extract_text() or "") for page in reader.pages)

        if suffix == ".docx":
            doc = DocxDocument(BytesIO(payload))
            return "\n".join(paragraph.text for paragraph in doc.paragraphs)

        raise ValueError(f"Unsupported document type: {suffix}")

    def _chunk_text(self, text: str) -> list[str]:
        """Split text into overlapping windows selected by document length."""
        clean = (text or "").strip()
        if not clean:
            return []

        length = len(clean)
        if length < self.settings.chunking_tiny_threshold:
            window, overlap = 400, 50
        elif length < self.settings.chunking_small_threshold:
            window, overlap = 900, 120
        else:
            window, overlap = 1800, 300

        chunks: list[str] = []
        start = 0
        while start < length:
            end = min(start + window, length)
            chunk = clean[start:end].strip()
            if chunk:
                chunks.append(chunk)
            if end == length:
                break
            start = max(0, end - overlap)

        return chunks
