# VectorStore Verification Guide

This guide explains how to verify that documents are correctly ingested and stored in the VectorStore (PostgreSQL PGVector), and how to troubleshoot RAG (Retrieval-Augmented Generation) issues.

## Document Upload Flow

The document ingestion process follows this pipeline:

```
File Upload (/documents/upload)
    ↓
TikaDocumentReader (parses PDF/TXT/DOCX)
    ↓
TokenTextSplitter (chunks document into smaller pieces)
    ↓
VectorStore.add(chunks) → Embeds chunks & stores in PostgreSQL
    ↓
DocumentMetadata saved → Tracks filename, chunkCount, etc.
```

---

## How to Verify VectorStore Has Uploaded Documents

### **Step 1: Upload a Document**

```bash
curl -X POST http://localhost:8080/documents/upload \
  -F "file=@document.pdf"
```

**Success Response:**
```json
{
  "id": 1,
  "filename": "document.pdf",
  "contentType": "application/pdf",
  "fileSize": 45678,
  "uploadTime": "2024-04-24T10:30:00",
  "chunkCount": 15
}
```

✅ `chunkCount > 0` indicates the document was successfully chunked and stored.

---

## Verification Methods (4 Ways)

### **Method A: Check DocumentMetadata via API (Easiest)**

Lists all uploaded documents with metadata:

```bash
curl http://localhost:8080/documents
```

**Response:**
```json
[
  {
    "id": 1,
    "filename": "document.pdf",
    "contentType": "application/pdf",
    "fileSize": 45678,
    "uploadTime": "2024-04-24T10:30:00",
    "chunkCount": 15
  }
]
```

**What to check:**
- ✅ `chunkCount > 0` → Document was split into chunks
- ✅ `uploadTime` shows recent timestamp → Document was just uploaded
- ❌ `chunkCount = 0` → Ingestion may have failed

---

### **Method B: Verify VectorStore Content (NEW)**

Runs a test similarity search to verify VectorStore has content:

```bash
curl http://localhost:8080/documents/verify
```

**Response:**
```json
{
  "status": "ok",
  "documentsCount": 25,
  "documents": [
    {
      "filename": "document.pdf",
      "contentLength": 5432,
      "contentPreview": "Document content preview here..."
    }
  ]
}
```

**What to check:**
- ✅ `status: "ok"` → VectorStore is accessible
- ✅ `documentsCount > 0` → Embeddings are stored
- ✅ `contentPreview` shows actual document text → Chunks are retrievable
- ❌ `status: "error"` → VectorStore connection or embedding failed

---

### **Method C: Test Query Search (NEW)**

Verifies the RAG similarity search is working:

```bash
curl "http://localhost:8080/documents/verify/search?query=your_search_term"
```

**Response:**
```json
{
  "query": "your_search_term",
  "hitsFound": 5
}
```

**What to check:**
- ✅ `hitsFound > 0` → VectorStore found relevant chunks for your query
- ❌ `hitsFound = 0` → No documents match the query (may be expected if documents don't cover the topic)
- ⚠️ Very low `hitsFound` → Try different search terms or check `similarity-threshold` in config

**Test Different Queries:**
```bash
# Generic search to get all documents
curl "http://localhost:8080/documents/verify/search?query=document"

# Specific domain search
curl "http://localhost:8080/documents/verify/search?query=machine learning"
```

---

### **Method D: Direct PostgreSQL Query (Most Detailed)**

For advanced debugging, query PostgreSQL directly:

```bash
# Connect to PostgreSQL
psql -U postgres -h localhost -d ragdb -p 5432
```

**Check Document Metadata Table:**
```sql
SELECT id, filename, content_type, file_size, chunk_count, upload_time 
FROM document_metadata 
ORDER BY upload_time DESC;
```

**Expected Output:**
```
 id | filename      | content_type     | file_size | chunk_count | upload_time
----+---------------+------------------+-----------+-------------+---------------------
  1 | document.pdf  | application/pdf  |     45678 |          15 | 2024-04-24 10:30:00
```

**Check VectorStore (Embeddings) Table:**
```sql
-- Total chunks stored
SELECT COUNT(*) as total_chunks FROM vector_store;

-- Documents stored
SELECT DISTINCT metadata->>'filename' FROM vector_store;

-- Sample chunk content
SELECT id, content, metadata->>'filename' AS filename, embedding
FROM vector_store 
LIMIT 5;

-- Check embedding dimensions (should be 384 or 768)
SELECT octet_length(embedding::text) FROM vector_store LIMIT 1;
```

**Delete a Specific Document from VectorStore:**
```sql
DELETE FROM vector_store WHERE metadata->>'filename' = 'document.pdf';
```

---

## What Gets Stored in VectorStore

| Component | Details |
|-----------|---------|
| **Content** | Document text chunks (split by TokenTextSplitter) |
| **Embedding** | Vector representation (384 dims = all-MiniLM-L6-v2 ONNX model) |
| **Metadata** | `filename`: original PDF/TXT name; custom metadata as JSON |
| **Vector Store Table** | `vector_store` in PostgreSQL with HNSW index for fast similarity search |
| **Rows per doc** | Multiple rows (one per chunk) |
| **Similarity Metric** | Cosine distance (configured in HNSW index) |

---

## Common Issues & Troubleshooting

| Issue | Symptoms | Root Cause | Fix |
|-------|----------|-----------|-----|
| **Document uploaded but not searchable** | `chunkCount = 0` in `/documents` | Ingestion or chunking failed | Check logs: `docker logs <backend>` |
| **VectorStore returns 0 documents** | `/documents/verify` shows `status: error` | Embedding model not initialized or PostgreSQL down | Ensure PGVector is running: `docker compose up pgvector -d` |
| **RAG returns no results** | `/ai/chat` returns generic response even after upload | `similarity-threshold` too high | Lower threshold in `application.yaml` or upload more documents |
| **File type not supported** | Upload fails silently | Only PDF, TXT, DOCX are supported | Check file extension; use TikaDocumentReader supported formats |
| **Embedding model not downloaded** | First request takes 5-10 minutes | Model (~90MB) downloads from HuggingFace on first run | Wait for download to complete; check logs for "all-MiniLM-L6-v2" |
| **Document deleted but still searchable** | Old results appear | Manual DB cleanup incomplete | Verify deletion via SQL: `SELECT COUNT(*) FROM vector_store WHERE metadata->>'filename' = 'document.pdf'` |

---

## System Architecture

### PostgreSQL Schema

**Tables Created by `/ai-cookbook-java-backend/src/main/resources/db/migration/V1__init_schema.sql`:**

```sql
-- Embeddings storage (created by Spring AI)
CREATE TABLE vector_store (
    id        UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    content   TEXT,
    metadata  JSON,
    embedding VECTOR(384)  -- all-MiniLM-L6-v2 model output
);

-- Document metadata tracking
CREATE TABLE document_metadata (
    id           BIGSERIAL    PRIMARY KEY,
    filename     VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    file_size    BIGINT,
    upload_time  TIMESTAMP    NOT NULL DEFAULT NOW(),
    chunk_count  INTEGER      NOT NULL DEFAULT 0
);
```

### Configuration

VectorStore behavior is controlled in `application.yaml`:

```yaml
app:
  rag:
    mode: soft              # 'soft' or 'strict'
    top-k: 5                # chunks retrieved per query
    similarity-threshold: 0.7  # 0.0-1.0 (lower = more results)
```

---

## API Endpoints Reference

### Document Upload & Management
- `POST /documents/upload` — Upload a file (PDF, TXT, DOCX)
- `GET /documents` — List all uploaded documents
- `DELETE /documents/{id}` — Delete a document

### VectorStore Verification (NEW)
- `GET /documents/verify` — Check VectorStore content and list documents
- `GET /documents/verify/search?query=<text>` — Test similarity search

### Chat with RAG
- `GET /ai/chat?message=<text>` — Chat with document context (streams JSON)
- `GET /ai/chat/string?message=<text>` — Chat with document context (streams text)
- `GET /ai/chat/string/client?message=<text>` — Chat using ChatClient (streams text)

---

## Example Workflow: Upload & Verify

```bash
# 1. Start the application
./gradlew bootRun

# 2. Start PostgreSQL (if not running)
docker compose up pgvector -d

# 3. Upload a document
curl -X POST http://localhost:8080/documents/upload \
  -F "file=@my_document.pdf"

# 4. Check if it was ingested
curl http://localhost:8080/documents

# 5. Verify VectorStore has embeddings
curl http://localhost:8080/documents/verify

# 6. Test a search query
curl "http://localhost:8080/documents/verify/search?query=important keywords"

# 7. Ask the chatbot a question
curl "http://localhost:8080/ai/chat/string?message=Tell me about the document"
```

---

## Debugging Logs

Enable debug logging in `application.yaml`:

```yaml
logging:
  level:
    in.ai.chatbot: DEBUG
    org.springframework.ai: DEBUG
```

Then check logs for:
- `RAG [soft] X chunk(s) found for: '<query>'` → Documents retrieved successfully
- `Stored X chunks for '<filename>'` → Ingestion successful
- `VectorStore verification query '<query>' returned X documents` → Search working

---

## Performance Tips

1. **Chunk Size Optimization**: Adjust `TokenTextSplitter` parameters for better context
2. **Similarity Threshold**: Start at 0.5, adjust based on result quality
3. **Top-K Selection**: 3-5 chunks usually optimal; more = slower response
4. **Index Maintenance**: Periodically delete old documents to keep VectorStore lean
5. **Batch Operations**: Upload multiple related documents for better RAG performance

---

## Next Steps

- Test with your own documents
- Adjust `application.yaml` RAG settings for your use case
- Monitor logs to understand what's being retrieved
- Use the verification endpoints to debug search quality

