from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from app.models.conversation_message import ConversationMessage


@dataclass
class ConversationSummary:
    """Aggregated timestamps, count, and preview for one conversation."""

    conversation_id: str
    started_at: datetime
    last_activity: datetime
    message_count: int
    preview: str | None


class ConversationRepository:
    """Persist ordered conversation messages and aggregate conversation summaries."""

    def __init__(self, session: Session) -> None:
        """Bind repository operations to a caller-managed SQLAlchemy session."""
        self.session = session

    def create_message(self, entity: ConversationMessage) -> ConversationMessage:
        """Stage and flush one conversation message."""
        self.session.add(entity)
        self.session.flush()
        return entity

    def find_by_conversation_id_ordered(self, conversation_id: str) -> list[ConversationMessage]:
        """Return messages ordered by their conversation-local index."""
        stmt = (
            select(ConversationMessage)
            .where(ConversationMessage.conversation_id == conversation_id)
            .order_by(ConversationMessage.message_index.asc())
        )
        return list(self.session.scalars(stmt).all())

    def delete_by_conversation_id(self, conversation_id: str) -> int:
        """Delete all messages for a conversation and return the row count."""
        result = self.session.execute(
            delete(ConversationMessage).where(
                ConversationMessage.conversation_id == conversation_id
            )
        )
        return int(result.rowcount or 0)

    def find_distinct_conversation_ids(self) -> list[str]:
        """Return identifiers for conversations with at least one message."""
        stmt = select(ConversationMessage.conversation_id).distinct()
        return list(self.session.scalars(stmt).all())

    def find_conversation_summaries(self) -> list[ConversationSummary]:
        """Aggregate timestamps, counts, and the first user preview per conversation."""
        query = text(
            """
            SELECT cm.conversation_id,
                   MIN(cm.created_at) AS started_at,
                   MAX(cm.created_at) AS last_activity,
                   COUNT(cm.id) AS message_count,
                   (
                       SELECT sub.content
                       FROM conversation_messages sub
                       WHERE sub.conversation_id = cm.conversation_id
                         AND sub.role = 'USER'
                       ORDER BY sub.message_index ASC
                       LIMIT 1
                   ) AS preview
            FROM conversation_messages cm
            GROUP BY cm.conversation_id
            ORDER BY last_activity DESC
            """
        )

        rows = self.session.execute(query).all()
        return [
            ConversationSummary(
                conversation_id=row[0],
                started_at=row[1],
                last_activity=row[2],
                message_count=int(row[3]),
                preview=row[4],
            )
            for row in rows
        ]
