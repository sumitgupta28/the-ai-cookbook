from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import (
    ConversationMessageRead,
    ConversationSummaryRead,
    DocumentMetadataRead,
    ProductRead,
)
from app.services import (
    ConversationPersistenceService,
    DocumentPersistenceService,
    ProductPersistenceService,
)

router = APIRouter(tags=["persistence"])


@router.get("/documents", response_model=list[DocumentMetadataRead])
def list_documents(session: Session = Depends(get_db)):
    """List persisted document metadata ordered by upload time."""
    service = DocumentPersistenceService(session)
    return service.list_documents()


@router.get("/products", response_model=list[ProductRead])
def list_products(session: Session = Depends(get_db)):
    """List persisted products ordered by creation time."""
    service = ProductPersistenceService(session)
    return service.list_products()


@router.get("/conversations", response_model=list[ConversationSummaryRead])
def list_conversations(session: Session = Depends(get_db)):
    """List conversation summaries from the persistence adapter."""
    service = ConversationPersistenceService(session)
    return service.list_conversation_summaries()


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[ConversationMessageRead],
)
def get_conversation_messages(conversation_id: str, session: Session = Depends(get_db)):
    """Return ordered messages for one conversation."""
    service = ConversationPersistenceService(session)
    return service.get_conversation_messages(conversation_id)
