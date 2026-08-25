from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.repositories.document_metadata_repository import DocumentMetadataRepository
from app.schemas import DeleteResponse, DocumentMetadataRead
from app.services import IngestionService, RagService

router = APIRouter(prefix="/documents", tags=["documents"])


def serialize_document(row) -> dict:
    """Convert document metadata to the public API representation."""
    return {
        "id": row.id,
        "filename": row.filename,
        "contentType": row.content_type,
        "fileSize": row.file_size,
        "uploadTime": row.upload_time,
        "chunkCount": row.chunk_count,
    }


@router.get("", response_model=list[DocumentMetadataRead])
def list_documents(session: Session = Depends(get_db)):
    """List indexed documents ordered from newest to oldest."""
    return DocumentMetadataRepository(session).find_all_order_by_upload_time_desc()


@router.post("/upload", response_model=DocumentMetadataRead)
def upload_document(file: UploadFile = File(...), session: Session = Depends(get_db)):
    """Parse, chunk, embed, and index an uploaded document."""
    filename = file.filename or ""
    if not filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename")
    try:
        metadata = IngestionService(session, get_settings()).ingest_document(
            filename=filename,
            content_type=file.content_type,
            payload=file.file.read(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return metadata


@router.get("/verify")
def verify_documents(session: Session = Depends(get_db)):
    """Inspect indexed document chunks and return store health details."""
    rows = session.execute(
        text(
            "SELECT content, metadata, LENGTH(COALESCE(content, '')) FROM vector_store ORDER BY id"
        )
    ).all()
    documents = [
        {
            "filename": str((row[1] or {}).get("filename", "unknown")),
            "contentLength": int(row[2] or 0),
            "contentPreview": (row[0] or "")[:240],
        }
        for row in rows
    ]
    return {"status": "ok", "documentsCount": len(documents), "documents": documents}


@router.get("/verify/search")
def verify_search_documents(
    query: str,
    topK: int = 10,
    similarityThreshold: float = 0.0,
    session: Session = Depends(get_db),
):
    """Run a diagnostic similarity search against document vectors."""
    results = RagService(session, get_settings()).search_documents(
        query, top_k=topK, similarity_threshold=similarityThreshold
    )
    payload = [
        {
            "filename": result.filename,
            "similarity": result.similarity,
            "contentPreview": result.content_preview,
        }
        for result in results
    ]
    return {"query": query, "hitsFound": len(payload), "results": payload}


@router.delete("/{document_id}", response_model=DeleteResponse)
def delete_document(document_id: int, session: Session = Depends(get_db)):
    """Delete document metadata and its indexed vector chunks."""
    if not IngestionService(session, get_settings()).delete_document(document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": True}
