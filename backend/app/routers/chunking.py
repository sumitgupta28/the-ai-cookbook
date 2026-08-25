from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.services import IngestionService

router = APIRouter(prefix="/chunking", tags=["chunking"])


@router.post("/analyze")
def chunking_analyze(
    file: UploadFile = File(...),
    strategy: str = Form(default="RECURSIVE"),
    chunkSize: int = Form(default=1000),
    overlap: int = Form(default=100),
    session: Session = Depends(get_db),
):
    """Analyze document chunks without persisting the uploaded document."""
    if not 64 <= chunkSize <= 5000 or not 0 <= overlap <= 4999:
        raise HTTPException(status_code=422, detail="Invalid chunking parameters")
    filename = file.filename or ""
    if not filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename")
    text_content = (
        IngestionService(session, get_settings()).extract_text(filename, file.file.read()).strip()
    )
    window = chunkSize
    step = chunkSize if strategy == "TOKEN_TEXT" else max(1, chunkSize - overlap)
    chunks = []
    for start in range(0, len(text_content), step):
        chunk = text_content[start : start + window].strip()
        if chunk:
            chunks.append(chunk)
        if start + window >= len(text_content):
            break

    details = []
    chunk_lengths: list[int] = []
    total_chars = 0
    total_tokens = 0
    for index, chunk in enumerate(chunks):
        char_count = len(chunk)
        chunk_lengths.append(char_count)
        token_count = max(1, round(len(chunk.split()) * 1.3))
        total_chars += char_count
        total_tokens += token_count
        details.append(
            {
                "index": index,
                "charCount": char_count,
                "wordCount": len(chunk.split()),
                "estimatedTokens": token_count,
                "contentPreview": chunk[:300],
            }
        )
    count = len(details)
    return {
        "strategy": strategy,
        "chunkSize": chunkSize,
        "overlap": overlap,
        "totalChunks": count,
        "totalEstimatedTokens": total_tokens,
        "totalChars": total_chars,
        "avgCharsPerChunk": total_chars / count if count else 0,
        "avgEstimatedTokensPerChunk": total_tokens / count if count else 0,
        "minChunkChars": min(chunk_lengths, default=0),
        "maxChunkChars": max(chunk_lengths, default=0),
        "chunks": details,
    }
