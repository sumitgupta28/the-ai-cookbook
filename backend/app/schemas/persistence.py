from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class DocumentMetadataRead(BaseModel):
    """Read model for indexed document metadata."""

    id: int
    filename: str
    content_type: str | None
    file_size: int | None
    upload_time: datetime
    chunk_count: int


class ProductRead(BaseModel):
    """Read model for a catalog product."""

    id: int
    product_id: str
    name: str
    category: str | None
    brand: str | None
    description: str | None
    price: Decimal
    image_url: str | None
    rating: Decimal | None
    stock_count: int | None
    created_at: datetime
    updated_at: datetime


class ConversationMessageRead(BaseModel):
    """Read model for one stored conversation message."""

    id: int
    conversation_id: str
    message_index: int
    role: str
    content: str
    created_at: datetime


class ConversationSummaryRead(BaseModel):
    """Read model for an aggregated conversation summary."""

    conversation_id: str
    started_at: datetime
    last_activity: datetime
    message_count: int
    preview: str | None
