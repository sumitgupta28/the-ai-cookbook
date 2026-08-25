"""add product catalog

Revision ID: 0003_add_product_catalog
Revises: 0002_add_conversation_memory
Create Date: 2026-08-25
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0003_add_product_catalog"
down_revision = "0002_add_conversation_memory"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS product (
            id BIGSERIAL PRIMARY KEY,
            product_id VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(500) NOT NULL,
            category VARCHAR(100),
            brand VARCHAR(100),
            description TEXT,
            price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            image_url VARCHAR(2000),
            rating DECIMAL(3, 1),
            stock_count INTEGER DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_product_product_id ON product(product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_product_category ON product(category)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS product_vector_store (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            content TEXT,
            metadata JSON,
            embedding VECTOR(384)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS product_vector_store_embedding_index
        ON product_vector_store USING HNSW (embedding vector_cosine_ops)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS product_vector_store_embedding_index")
    op.execute("DROP TABLE IF EXISTS product_vector_store")
    op.execute("DROP INDEX IF EXISTS idx_product_category")
    op.execute("DROP INDEX IF EXISTS idx_product_product_id")
    op.execute("DROP TABLE IF EXISTS product")
