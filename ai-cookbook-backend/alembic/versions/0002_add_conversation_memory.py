"""add conversation memory

Revision ID: 0002_add_conversation_memory
Revises: 0001_init_schema
Create Date: 2026-08-25
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0002_add_conversation_memory"
down_revision = "0001_init_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS conversation_messages (
            id BIGSERIAL PRIMARY KEY,
            conversation_id VARCHAR(36) NOT NULL,
            message_index INTEGER NOT NULL,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_id
        ON conversation_messages (conversation_id, message_index)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_conv_messages_conv_id")
    op.execute("DROP TABLE IF EXISTS conversation_messages")
