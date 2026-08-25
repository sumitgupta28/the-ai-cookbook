from dataclasses import dataclass

from app.models.conversation_message import ConversationMessage
from app.repositories.conversation_repository import ConversationRepository


@dataclass
class MemoryMessage:
    """Lightweight role/content message used by chat-memory persistence."""

    role: str
    content: str


class ChatMemoryRepository:
    """
    Python parity for JdbcChatMemoryRepository behavior.

    Semantics:
    - save_all performs full replace for a conversation.
    - find_by_conversation_id returns messages ordered by message_index.
    - delete_by_conversation_id removes all messages for a conversation.
    """

    def __init__(self, conversation_repository: ConversationRepository) -> None:
        """Wrap the conversation repository with chat-memory semantics."""
        self.conversation_repository = conversation_repository

    def find_conversation_ids(self) -> list[str]:
        """Return all conversation identifiers known to the repository."""
        return self.conversation_repository.find_distinct_conversation_ids()

    def find_by_conversation_id(self, conversation_id: str) -> list[MemoryMessage]:
        """Read ordered messages as lightweight memory records."""
        rows = self.conversation_repository.find_by_conversation_id_ordered(conversation_id)
        return [MemoryMessage(role=row.role, content=row.content) for row in rows]

    def save_all(self, conversation_id: str, messages: list[MemoryMessage]) -> None:
        """Replace a conversation's full message window with validated roles."""
        self.conversation_repository.delete_by_conversation_id(conversation_id)
        for index, message in enumerate(messages):
            role = (message.role or "USER").upper()
            if role not in {"USER", "ASSISTANT", "SYSTEM"}:
                role = "USER"
            self.conversation_repository.create_message(
                ConversationMessage(
                    conversation_id=conversation_id,
                    message_index=index,
                    role=role,
                    content=message.content,
                )
            )

    def delete_by_conversation_id(self, conversation_id: str) -> None:
        """Delete all stored memory messages for a conversation."""
        self.conversation_repository.delete_by_conversation_id(conversation_id)
