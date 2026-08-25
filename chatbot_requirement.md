# Chatbot Requirements — Python Migration

**Purpose**: This document captures the full requirements for rebuilding the Spring Boot backend in Python (FastAPI), while keeping the React frontend largely intact. The frontend will receive one targeted change: replacing axios non-streaming GET requests with `EventSource`-based SSE consumption for real-time token display.

---

## 1. Overview

A Retrieval-Augmented Generation (RAG) chatbot with four functional areas:

| Tab | Purpose |
|-----|---------|
| 💬 Chat | Direct LLM chat — no document context |
| 🔍 RAG Chat | LLM chat augmented with indexed document chunks |
| 📄 Documents | Upload, list, and delete indexed documents |
| 🗄️ Vector Search | Inspect vector store health and test similarity search |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Docker Compose                         │
│                                                         │
│  ┌──────────────┐   ┌───────────────┐   ┌───────────┐  │
│  │  React UI    │──▶│  FastAPI App  │──▶│ PGVector  │  │
│  │  (port 3000) │   │  (port 8080)  │   │ (port 5432│  │
│  └──────────────┘   └───────┬───────┘   └───────────┘  │
│                             │                           │
│                     ┌───────┴───────┐                   │
│                     │  LLM Provider │                   │
│                     │  Ollama/Anthr │                   │
│                     └───────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

**Streaming flow**: FastAPI streams tokens via SSE → React frontend consumes with `EventSource` and renders tokens as they arrive (typing effect).

---

## 3. Technology Stack

### Backend (new — Python)

| Concern | Technology |
|---------|-----------|
| Web framework | **FastAPI** (async) |
| RAG / LLM framework | **LangChain** |
| LLM providers | **Ollama** (default) · **Anthropic Claude** (via profile) |
| Embeddings | **sentence-transformers** — `all-MiniLM-L6-v2` (local, 384-dim) |
| Vector store | **PGVector** via `langchain-postgres` |
| Document parsing | **PyMuPDF** (PDF) · **python-docx** (DOCX) · built-in `open()` (TXT) |
| ORM | **SQLAlchemy** (async via `asyncpg`) |
| DB migrations | **Alembic** |
| Streaming | **SSE** via FastAPI `StreamingResponse` + `text/event-stream` |
| ASGI server | **Uvicorn** |
| Config management | **pydantic-settings** (`.env` file) |
| Python version | **3.11+** |

### Frontend (unchanged except SSE)

| Concern | Technology |
|---------|-----------|
| Framework | React 18 (Create React App) |
| HTTP client | axios (Documents tab) · **`EventSource`** (Chat + RAG Chat tabs) |
| Styling | Tailwind CSS |
| Icons | react-icons |

### Infrastructure (unchanged)

| Service | Image | Port |
|---------|-------|------|
| Python backend | Custom Dockerfile | 8080 |
| React UI | Custom Dockerfile (nginx) | 3000 |
| PGVector | `pgvector/pgvector:pg17` | 5432 |

---

## 4. Database Schema

**Unchanged from the Spring Boot version.** Alembic replaces Flyway for migrations.

### 4.1 `vector_store` (managed by LangChain PGVector)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `content` | TEXT | Chunk text |
| `metadata` | JSON | Includes `filename`, `source`, etc. |
| `embedding` | VECTOR(384) | all-MiniLM-L6-v2 output |

- Index: **HNSW** on `embedding` with cosine distance
- Required PostgreSQL extensions: `vector`, `hstore`

### 4.2 `document_metadata` (custom table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGSERIAL (PK) | Auto-increment |
| `filename` | VARCHAR(255) | Original file name |
| `content_type` | VARCHAR(100) | MIME type |
| `file_size` | BIGINT | Bytes |
| `upload_time` | TIMESTAMP | Defaults to `NOW()` |
| `chunk_count` | INTEGER | Total chunks created |

### 4.3 Alembic Migration

Initial migration (`V1_init_schema`) must:
1. Enable `vector` and `hstore` extensions
2. Create `document_metadata` table
3. Create `vector_store` table with HNSW index

---

## 5. Configuration & Profiles

### 5.1 Environment Variables (`.env`)

```dotenv
# LLM provider profile: "ollama" (default) or "anthropic"
LLM_PROVIDER=ollama

# Ollama settings (used when LLM_PROVIDER=ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3.2
OLLAMA_TEMPERATURE=0.7

# Anthropic settings (used when LLM_PROVIDER=anthropic)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_CHAT_MODEL=claude-sonnet-4-6
ANTHROPIC_TEMPERATURE=0.7

# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ragdb

# RAG defaults
RAG_MODE=soft
RAG_TOP_K=5
RAG_SIMILARITY_THRESHOLD=0.0

# Embedding model
EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2

# Upload limits
MAX_UPLOAD_SIZE_MB=50
```

### 5.2 Provider Selection

The active LLM is selected at startup via `LLM_PROVIDER`. A factory function returns the appropriate LangChain `BaseChatModel`:

```
LLM_PROVIDER=ollama    → ChatOllama(model=OLLAMA_CHAT_MODEL, ...)
LLM_PROVIDER=anthropic → ChatAnthropic(model=ANTHROPIC_CHAT_MODEL, ...)
```

The embedding model is **always local** (`sentence-transformers`) regardless of the chat provider.

---

## 6. API Endpoints

All endpoints must be accessible at `http://localhost:8080`. The path structure is **identical** to the Spring Boot version so the frontend requires no URL changes.

### 6.1 CORS

```
Allowed origins:  http://localhost:3000
Allowed methods:  GET, POST, DELETE
Allowed headers:  *
Allow credentials: true
```

---

### 6.2 Direct Chat — `/ai/chat`

#### `GET /ai/chat/string`

Used by the **Chat tab**.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `message` | string | yes | — | User query |

**Response**: `text/event-stream` (SSE)

Each SSE event:
```
data: <token text>\n\n
```

Final event (signals end of stream):
```
data: [DONE]\n\n
```

**Logic**:
1. Build a simple `HumanMessage` prompt (no system prompt, no document context)
2. Call `llm.astream(messages)` (LangChain async stream)
3. Yield each token chunk as an SSE `data:` event
4. Yield `data: [DONE]` when stream ends

---

### 6.3 RAG Chat — `/rag/ai/chat`

#### `GET /rag/ai/chat/string/client`

Used by the **RAG Chat tab**.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `message` | string | yes | — | User query |
| `topK` | int | no | 5 | Max chunks retrieved from vector store |
| `similarityThreshold` | float | no | 0.0 | Min similarity score (0.0–1.0) |
| `mode` | string | no | `soft` | `soft` = docs + fallback · `strict` = docs only |
| `temperature` | float | no | 0.7 | LLM creativity (0.0–1.0) |
| `maxTokens` | int | no | 1000 | Max response tokens |

**Response**: `text/event-stream` (SSE) — same format as `/ai/chat/string`

**Logic**:
1. Call `build_rag_context(message, topK, similarityThreshold, mode)`
2. If `short_circuit=True`: yield the short-circuit message as a single SSE event, then `[DONE]`
3. Otherwise, build `[SystemMessage(system_prompt), HumanMessage(message)]`
4. Override LLM temperature and max_tokens per request
5. Stream via `llm.astream(messages)`, yielding SSE events

**RAG Context Logic** (`build_rag_context`):

```
chunks = vector_store.similarity_search_with_score(message, k=topK)
chunks = [c for c in chunks if score >= similarityThreshold]

if not chunks:
    if mode == "strict":
        return short_circuit("I don't have information about this in the uploaded documents.")
    else:  # soft
        return no_system_prompt()

context_text = "\n\n---\n\n".join([chunk.page_content for chunk in chunks])

if mode == "soft":
    system_prompt = SOFT_PROMPT.format(context=context_text)
else:
    system_prompt = STRICT_PROMPT.format(context=context_text)

return system_prompt
```

**System prompt templates**:

```
SOFT_PROMPT:
  "You are a helpful assistant. Relevant context from uploaded documents:\n\n{context}\n\n
   If the context contains relevant information, use it and cite it. 
   If not, supplement with your general knowledge."

STRICT_PROMPT:
  "Answer ONLY based on the context provided below. 
   If the context is insufficient, reply: 'I don't have information about this in the uploaded documents.'\n\n
   Context:\n{context}"
```

---

### 6.4 Documents — `/documents`

#### `POST /documents/upload`

| | |
|--|--|
| Content-Type | `multipart/form-data` |
| Field | `file` |
| Accepted types | `application/pdf`, `text/plain`, `.docx` |
| Max size | 50 MB |

**Response** `200 OK`:
```json
{
  "id": 1,
  "filename": "myfile.pdf",
  "contentType": "application/pdf",
  "fileSize": 245000,
  "uploadTime": "2026-04-24T10:30:45.123",
  "chunkCount": 12
}
```

**Upload pipeline**:
1. Validate MIME type (PDF / TXT / DOCX only)
2. Validate file not empty; enforce 50 MB limit
3. Parse document text:
   - PDF → `PyMuPDF` (`fitz.open()`)
   - DOCX → `python-docx` (`Document.paragraphs`)
   - TXT → built-in `open()` with UTF-8 decode
4. Validate extracted text is non-empty
5. Split into chunks using LangChain `RecursiveCharacterTextSplitter`:
   - `chunk_size=512` (characters)
   - `chunk_overlap=100`
   - `separators=["\n\n", "\n", ".", ",", "!", "?", ":", ";", " ", ""]`
6. Add `{"filename": original_filename}` to each chunk's metadata
7. Embed all chunks with `SentenceTransformerEmbeddings` and store in PGVector
8. Save `DocumentMetadata` row to PostgreSQL
9. Return `DocumentInfo` JSON

**Error responses**:
- `400` — unsupported file type, empty file, no text extracted, no chunks produced
- `500` — vector store or database failure

---

#### `GET /documents`

**Response** `200 OK`: Array of `DocumentInfo`, sorted by `uploadTime` descending.

```json
[
  {
    "id": 1,
    "filename": "myfile.pdf",
    "contentType": "application/pdf",
    "fileSize": 245000,
    "uploadTime": "2026-04-24T10:30:45.123",
    "chunkCount": 12
  }
]
```

---

#### `DELETE /documents/{id}`

| Path param | Type | Description |
|-----------|------|-------------|
| `id` | int | `document_metadata.id` |

**Response**: `204 No Content`

**Logic** (single database transaction):
1. Fetch `DocumentMetadata` by `id` (404 if not found)
2. Delete all rows from `vector_store` where `metadata->>'filename' = doc.filename`
3. Delete `DocumentMetadata` row

---

#### `GET /documents/verify`

**Response** `200 OK`:
```json
{
  "status": "ok",
  "documentsCount": 42,
  "documents": [
    {
      "filename": "myfile.pdf",
      "contentLength": 1523,
      "contentPreview": "First 100 chars of chunk text..."
    }
  ]
}
```

**Logic**:
1. Run similarity search with a broad query (`"*"` or `" "`), `topK=1000`, `threshold=0.0`
2. Deduplicate chunks by content
3. Return count + metadata list

---

#### `GET /documents/verify/search`

Used by the **Vector Search tab**.

| Param | Type | Required | Default |
|-------|------|----------|---------|
| `query` | string | yes | — |
| `topK` | int | no | 10 |
| `similarityThreshold` | float | no | 0.0 |

**Response** `200 OK`:
```json
{
  "query": "machine learning",
  "hitsFound": 5,
  "results": [
    {
      "filename": "myfile.pdf",
      "similarity": 0.85,
      "contentPreview": "Machine learning is a subset..."
    }
  ]
}
```

**Logic**:
1. `similarity_search_with_score(query, k=topK)`
2. Filter by `score >= similarityThreshold`
3. Compute `similarity = 1 - distance` (cosine distance → similarity score)
4. Return results sorted by similarity descending

---

## 7. Embedding Model

| Property | Value |
|----------|-------|
| Model | `all-MiniLM-L6-v2` |
| Source | HuggingFace (downloaded on first use, ~90 MB, then cached) |
| Dimensions | 384 |
| Library | `sentence-transformers` |
| LangChain wrapper | `HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")` |
| Provider dependency | None — always local, regardless of chat LLM |

The embedding model must be initialized once at application startup and reused (not re-loaded per request).

---

## 8. Document Chunking

| Property | Value |
|----------|-------|
| Splitter | `RecursiveCharacterTextSplitter` (LangChain) |
| Chunk size | 512 characters |
| Chunk overlap | 100 characters |
| Separators | `["\n\n", "\n", ".", ",", "!", "?", ":", ";", " ", ""]` |
| Min chunk | Discard chunks shorter than 50 characters |

Each chunk document must carry `metadata["filename"]` so deletion and filtering work correctly.

---

## 9. SSE Streaming — Format Specification

Both `/ai/chat/string` and `/rag/ai/chat/string/client` must return `text/event-stream`.

**Response headers**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```

**Event format** (one per token):
```
data: <token>\n\n
```

**End-of-stream marker**:
```
data: [DONE]\n\n
```

**FastAPI implementation pattern**:
```python
from fastapi.responses import StreamingResponse

async def token_generator(message: str):
    async for chunk in llm.astream([HumanMessage(content=message)]):
        token = chunk.content
        if token:
            yield f"data: {token}\n\n"
    yield "data: [DONE]\n\n"

return StreamingResponse(token_generator(message), media_type="text/event-stream")
```

---

## 10. Frontend Changes (React)

**Only the Chat tab (`ChatBot.js`) and RAG Chat tab (`RAGChatbot.js`) need to change.** All other components (`DocumentUpload.js`, `VectorSearch.js`, `App.js`) remain unchanged.

### 10.1 Replace axios with `EventSource` in ChatBot.js and RAGChatbot.js

**Current behavior**: `axios.get(url)` — waits for full response, displays all at once.

**New behavior**: `EventSource` opens an SSE connection, appends tokens to the message as they arrive (typing effect).

**Pattern**:
```javascript
const sendMessage = (text) => {
  setLoading(true);
  const aiMessageId = Date.now();
  setMessages(prev => [...prev, { id: aiMessageId, text: "", sender: "ai" }]);

  const url = `${API_BASE}/ai/chat/string?message=${encodeURIComponent(text)}`;
  const es = new EventSource(url);

  es.onmessage = (event) => {
    if (event.data === "[DONE]") {
      es.close();
      setLoading(false);
      return;
    }
    setMessages(prev =>
      prev.map(m =>
        m.id === aiMessageId ? { ...m, text: m.text + event.data } : m
      )
    );
  };

  es.onerror = () => {
    es.close();
    setLoading(false);
  };
};
```

**RAGChatbot.js** uses the same pattern with the full query string including `topK`, `similarityThreshold`, `mode`, `temperature`, `maxTokens` params.

### 10.2 No other frontend changes

- Tab structure, routing, styling, icons — all unchanged
- `DocumentUpload.js` — continues using axios (non-streaming POST/GET/DELETE)
- `VectorSearch.js` — continues using axios (non-streaming GET)
- `REACT_APP_API_BASE_URL` environment variable — unchanged

---

## 11. Project Structure (Python Backend)

```
ai-cookbook-backend/
├── app/
│   ├── main.py                    # FastAPI app, CORS, router registration
│   ├── config.py                  # pydantic-settings — loads .env
│   ├── dependencies.py            # Shared FastAPI dependencies (llm, embeddings, vector_store)
│   ├── routers/
│   │   ├── chat.py                # GET /ai/chat/string
│   │   ├── rag_chat.py            # GET /rag/ai/chat/string/client
│   │   └── documents.py           # /documents/* endpoints
│   ├── services/
│   │   ├── rag_service.py         # build_rag_context(), search_documents()
│   │   └── ingestion_service.py   # ingest(), list_documents(), delete_document()
│   ├── models/
│   │   ├── db.py                  # SQLAlchemy DocumentMetadata model
│   │   └── schemas.py             # Pydantic response schemas (DocumentInfo, SearchResult, etc.)
│   ├── db/
│   │   └── session.py             # Async SQLAlchemy engine + session factory
│   └── parsers/
│       ├── pdf_parser.py          # PyMuPDF text extraction
│       ├── docx_parser.py         # python-docx text extraction
│       └── txt_parser.py          # Plain text reader
├── alembic/
│   ├── env.py
│   ├── versions/
│   │   └── 0001_init_schema.py    # vector_store + document_metadata tables, HNSW index
│   └── alembic.ini
├── .env.example
├── requirements.txt
├── Dockerfile
└── docker-compose.yaml            # Replaces ai-cookbook-java-backend service with ai-cookbook-backend
```

---

## 12. Python Dependencies (`requirements.txt`)

```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
pydantic-settings>=2.2.0

# LangChain
langchain>=0.2.0
langchain-community>=0.2.0
langchain-anthropic>=0.1.0
langchain-ollama>=0.1.0
langchain-postgres>=0.0.9
langchain-huggingface>=0.0.3

# Embeddings
sentence-transformers>=2.7.0

# Document parsing
pymupdf>=1.24.0
python-docx>=1.1.0

# Database
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.29.0
psycopg2-binary>=2.9.0
alembic>=1.13.0

# Utilities
python-multipart>=0.0.9     # FastAPI file upload support
```

---

## 13. Docker Compose (Updated)

Use the `ai-cookbook-backend` service alongside `ai-cookbook-java-backend`. The frontend service is `ai-cookbook-frontend`; pgvector, ports, volumes, and network remain unchanged.

```yaml
services:
  pgvector:
    image: pgvector/pgvector:pg17
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: ragdb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes: [pgvector_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      retries: 5

  ai-cookbook-backend:
    build: ./ai-cookbook-backend
    ports: ["8080:8080"]
    environment:
      LLM_PROVIDER: ${LLM_PROVIDER:-ollama}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      OLLAMA_BASE_URL: http://host.docker.internal:11434
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@pgvector:5432/ragdb
    depends_on:
      pgvector:
        condition: service_healthy
    networks: [app-network]

  ai-cookbook-frontend:
    build: ./ai-cookbook-frontend
    ports: ["3000:3000"]
    environment:
      REACT_APP_API_BASE_URL: http://localhost:8080
    networks: [app-network]

volumes:
  pgvector_data:

networks:
  app-network:
    driver: bridge
```

---

## 14. Key Differences from Spring Boot Version

| Aspect | Spring Boot (old) | FastAPI (new) |
|--------|------------------|---------------|
| Framework | Spring Boot 3.5 + Spring AI 1.1.4 | FastAPI + LangChain |
| Language | Java 17 | Python 3.11+ |
| Streaming | `Flux<String>` (Reactor) | `StreamingResponse` + async generator |
| Frontend streaming | axios (collects full response) | `EventSource` (real-time token display) |
| Embedding | Spring AI TransformersEmbeddingModel | `sentence-transformers` via LangChain |
| Document parsing | Apache Tika | PyMuPDF + python-docx + built-in |
| ORM | Hibernate / Spring Data JPA | SQLAlchemy (async) |
| Migrations | Flyway | Alembic |
| Config | Spring profiles + application.yaml | pydantic-settings + .env |
| ONNX runtime | Spring AI bundles it | Not needed — sentence-transformers handles it |
| Chunking | `TokenTextSplitter` (512 tokens) | `RecursiveCharacterTextSplitter` (512 chars) |

> **Note on chunk size units**: Spring Boot uses *token*-based chunking (512 tokens). LangChain's `RecursiveCharacterTextSplitter` uses *characters* by default. Use `chunk_size=512` characters as a practical equivalent; switch to `TokenTextSplitter` from LangChain if token-level parity is required.

---

## 15. Acceptance Criteria

- [ ] All four frontend tabs function identically to the Spring Boot version
- [ ] Chat tab shows real-time token streaming (typing effect)
- [ ] RAG Chat tab shows real-time token streaming with all 5 parameters working
- [ ] RAG strict mode returns the short-circuit message when no chunks match
- [ ] RAG soft mode falls back to general knowledge when no chunks match
- [ ] Document upload (PDF, DOCX, TXT) succeeds and reports correct chunk count
- [ ] Document list returns all uploaded documents sorted by upload time (newest first)
- [ ] Document delete removes entries from both `vector_store` and `document_metadata`
- [ ] Vector store health check returns all indexed chunks
- [ ] Similarity search returns results with correct similarity scores
- [ ] Switching between Ollama and Anthropic via `LLM_PROVIDER` env var works without code changes
- [ ] Embedding model is always local (sentence-transformers), regardless of LLM provider
- [ ] Full stack starts correctly with `docker compose up --build`
- [ ] Alembic migration creates correct schema on first start
