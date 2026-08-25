CREATE TABLE IF NOT EXISTS product (
    id          BIGSERIAL        PRIMARY KEY,
    product_id  VARCHAR(100)     NOT NULL UNIQUE,
    name        VARCHAR(500)     NOT NULL,
    category    VARCHAR(100),
    brand       VARCHAR(100),
    description TEXT,
    price       DECIMAL(10, 2)   NOT NULL DEFAULT 0.00,
    image_url   VARCHAR(2000),
    rating      DECIMAL(3, 1),
    stock_count INTEGER          DEFAULT 0,
    created_at  TIMESTAMP        NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP        NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_product_id ON product(product_id);
CREATE INDEX IF NOT EXISTS idx_product_category   ON product(category);

CREATE TABLE IF NOT EXISTS product_vector_store (
    id        UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    content   TEXT,
    metadata  JSON,
    embedding VECTOR(384)
);

CREATE INDEX IF NOT EXISTS product_vector_store_embedding_index
    ON product_vector_store USING HNSW (embedding vector_cosine_ops);
