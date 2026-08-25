# backend

Python backend scaffold for phased migration from Spring Boot.

## Quick start

1. Create and activate a virtual environment.
   macOS/Linux:
   python3 -m venv .venv
   source .venv/bin/activate

   Windows (PowerShell):
   python -m venv .venv
   .venv\Scripts\Activate.ps1
2. Install dependencies:
   python3 -m pip install -r requirements.txt

3. Copy environment template:
   cp .env.example .env

4. Run app:
   python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Health check: GET /health
Readiness check: GET /ready
Public API endpoints:
- GET /rag/context
- GET /rag/search
- GET /ai/chat/string
- GET /rag/ai/chat/string/client
- GET /rag/memory/ai/chat/string/client
- POST /rag/memory/ai/chat/json/client
- GET /rag/memory/conversations
- GET /rag/memory/conversations/{conversation_id}/messages
- DELETE /rag/memory/ai/chat/conversation/{conversation_id}
- GET /documents
- POST /documents/upload
- DELETE /documents/{document_id}
- GET /documents/verify
- GET /documents/verify/search
- GET /products
- POST /products/upload
- GET /products/search
- DELETE /products/{product_id}
- GET /products/verify
- GET /tool/ai/chat/string
- GET /structured/extract
- POST /chunking/analyze

## Side-by-side Docker deployment

From the repository root, start PostgreSQL/pgvector, Java, Python, and the UI:

   ANTHROPIC_API_KEY=... docker compose up --build

The Java service remains available on `http://localhost:8080`; the Python service
is available on `http://localhost:8000`. The React UI continues to use the Java
base URL by default, so traffic can be switched deliberately during the strangler
 rollout with `REACT_APP_API_BASE_URL`.

## Database migration tooling (Alembic)

Create a new migration revision:
alembic revision -m "describe change"

Run migrations:
alembic upgrade head

## Scope now

- Phase 0 artifacts are under phase0/
- Phase 1 foundation is under app/ and alembic/
- Persistence layer is under app/models, app/repositories, and app/vector
- Service/dto wiring is under app/services and app/schemas
- Alembic parity migrations (V1/V2/V3) are under alembic/versions
- Screen-specific routes are under app/routers/chat.py, rag.py, memory.py, documents.py, products.py, tools.py, structured.py, and chunking.py
- Shared migrated handler logic is under app/routers/compat.py
- Side-by-side container definition is in ../docker-compose.yaml
- Anthropic-first provider scope is preserved for release 1
