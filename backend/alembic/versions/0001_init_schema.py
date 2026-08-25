"""init schema

Revision ID: 0001_init_schema
Revises:
Create Date: 2026-08-25
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0001_init_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS hstore")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS vector_store (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            content TEXT,
            metadata JSON,
            embedding VECTOR(384)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS spring_ai_vector_store_embedding_index
        ON vector_store USING HNSW (embedding vector_cosine_ops)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS document_metadata (
            id BIGSERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            content_type VARCHAR(100),
            file_size BIGINT,
            upload_time TIMESTAMP NOT NULL DEFAULT NOW(),
            chunk_count INTEGER NOT NULL DEFAULT 0
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS document_metadata")
    op.execute("DROP INDEX IF EXISTS spring_ai_vector_store_embedding_index")
    op.execute("DROP TABLE IF EXISTS vector_store")
