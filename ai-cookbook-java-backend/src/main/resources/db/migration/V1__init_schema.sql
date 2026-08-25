-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS hstore;

-- Spring AI PGVector store table (768 dims = nomic-embed-text output)
CREATE TABLE IF NOT EXISTS vector_store (
    id        UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    content   TEXT,
    metadata  JSON,
    embedding VECTOR(384)
);

CREATE INDEX IF NOT EXISTS spring_ai_vector_store_embedding_index
    ON vector_store USING HNSW (embedding vector_cosine_ops);

-- RAG document metadata
CREATE TABLE IF NOT EXISTS document_metadata (
    id           BIGSERIAL    PRIMARY KEY,
    filename     VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    file_size    BIGINT,
    upload_time  TIMESTAMP    NOT NULL DEFAULT NOW(),
    chunk_count  INTEGER      NOT NULL DEFAULT 0
);
