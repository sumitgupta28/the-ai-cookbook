# The AI Cookbook

A full-stack AI chatbot application demonstrating Retrieval-Augmented Generation (RAG), conversation memory, semantic search, function-calling tools, and structured output extraction. It provides endpoint-compatible **Spring Boot** and **FastAPI** backends, both using Anthropic and the same PostgreSQL/pgvector data plane.

---

## Features

| Tab | What it does |
|---|---|
| 💬 **Chat** | Direct LLM chat with no document context |
| 🗄️ **Vector Search** | Inspect vector store health; run raw similarity searches against indexed chunks |
| 🔍 **RAG Chat** | LLM chat augmented with your uploaded documents; tunable per-request (topK, threshold, mode, temperature) |
| 🧠 **RAG + Memory** | RAG chat with persistent conversation history stored in PostgreSQL; supports multiple concurrent conversations |
| 📄 **Documents** | Upload PDF / DOCX / TXT files; view indexed documents; delete individual documents |
| 🔧 **Tool Agent** | LLM with function-calling tools: calculator, current date/time, weather lookup (Anthropic profile required) |
| 📊 **Structured Output** | Extract named entities (people, orgs, locations, dates, topics) from any text into typed JSON (Anthropic profile required) |
| 🛍️ **Product Search** | Upload a product catalog `.xlsx`, then run semantic similarity searches across the catalog |

---

## Tech Stack

### Backends
| Layer | Technology |
|---|---|
| Java | Spring Boot 3.5 + Spring AI 1.1.4 (port 8080) |
| Python | FastAPI + Anthropic SDK (port 8000) |
| LLM provider | Anthropic Claude |
| Embeddings | 384-dimensional local embeddings |
| Vector store | PostgreSQL + pgvector extension |
| Persistence | Spring Data JPA/Flyway and SQLAlchemy/Alembic |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 (Create React App) |
| HTTP | Axios |
| Styling | Tailwind CSS |
| Icons | react-icons |

### Infrastructure
| Service | Image | Port |
|---|---|---|
| Java backend | Custom Dockerfile (multi-stage) | 8080 |
| Python backend | Custom Dockerfile | 8000 |
| React UI | Custom Dockerfile (Node → nginx) | 3000 |
| PostgreSQL + pgvector | `pgvector/pgvector:pg17` | 5432 |

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker + Docker Compose | latest | Required for PGVector; optional for full-stack run |
| Java JDK | 21 | Only for running the Java backend outside Docker |
| Gradle | 8+ | Wrapper included (`./gradlew`) |
| Python | 3.12+ | Only for running the Python backend outside Docker |
| Node.js | 18+ | Only for running frontend outside Docker |
| Anthropic API key | — | Required by both backends |

---

## Quick Start

### Option A — Full stack via Docker Compose

```bash
cp .env.example .env
ANTHROPIC_API_KEY=sk-ant-... docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

---

### Option B — Local development (backend + frontend separately)

**1. Start PGVector only:**
```bash
docker compose up pgvector -d
```

**2. Start one backend:**
```bash
cd ai-cookbook-java-backend
ANTHROPIC_API_KEY=sk-ant-... ./gradlew bootRun
```

Or start the Python implementation:

```bash
cd ai-cookbook-backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
ANTHROPIC_API_KEY=sk-ant-... python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The Java backend starts on [http://localhost:8080](http://localhost:8080); the Python backend starts on [http://localhost:8000](http://localhost:8000).

**3. Start the frontend:**
```bash
  cd ai-cookbook-frontend
npm install
npm start
```
Frontend starts on [http://localhost:3000](http://localhost:3000).

The frontend targets Java by default. To target Python, start it with `REACT_APP_API_BASE_URL=http://localhost:8000 npm start`.

> **First run note:** The ONNX embedding model (`all-MiniLM-L6-v2`, ~90 MB) is downloaded from HuggingFace on first startup. Subsequent starts use the cached copy.

---

## Environment Variables

Copy `.env.example` to `.env` and set the values you need.

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key used by both backends |
| `REACT_APP_API_BASE_URL` | No | `http://localhost:8080` | Set to `http://localhost:8000` to target Python |

Database credentials (`SPRING_DATASOURCE_*`) are set automatically by Docker Compose. Override them if connecting to an external PostgreSQL instance.

---

## AI Provider

Both backends use Anthropic Claude and require `ANTHROPIC_API_KEY`. The Java implementation configures `spring.ai.model.chat: anthropic` in `application.yaml`; the Python implementation only accepts `AI_CHAT_PROVIDER=anthropic`.

The **Tool Agent** and **Structured Output** tabs use Anthropic function-calling and structured JSON output.

---

## API Reference

### Base URL
Java: `http://localhost:8080` (default frontend target)

Python: `http://localhost:8000` (set `REACT_APP_API_BASE_URL` to select it)

### Quick endpoint map

| Feature | Method | Path |
|---|---|---|
| Direct chat (streaming text) | GET | `/ai/chat/string` |
| RAG chat (streaming text) | GET | `/rag/ai/chat/string/client` |
| RAG + Memory chat | GET | `/rag/memory/ai/chat/string/client` |
| RAG + Memory chat (JSON response) | POST | `/rag/memory/ai/chat/json/client` |
| Delete conversation | DELETE | `/rag/memory/ai/chat/conversation/{conversationId}` |
| List conversations | GET | `/rag/memory/conversations` |
| Tool-augmented chat | GET | `/tool/ai/chat/string` |
| Structured entity extraction | GET | `/structured/extract` |
| Upload document | POST | `/documents/upload` |
| List documents | GET | `/documents` |
| Delete document | DELETE | `/documents/{id}` |
| Vector store health | GET | `/documents/verify` |
| Similarity search (debug) | GET | `/documents/verify/search` |
| Upload product catalog | POST | `/products/upload` |
| Semantic product search | GET | `/products/search` |
| List products | GET | `/products` |
| Delete product | DELETE | `/products/{id}` |

### RAG tuning parameters

All RAG endpoints accept these optional query parameters:

| Param | Default | Description |
|---|---|---|
| `message` | *(required)* | User query |
| `topK` | `5` | Max document chunks retrieved |
| `similarityThreshold` | `0.0` | Min similarity score (0–1) |
| `mode` | `soft` | `soft` = docs + general knowledge; `strict` = docs only |
| `temperature` | `0.7` | LLM creativity |
| `maxTokens` | `1000` | Max response length |

The `rag/memory` endpoint additionally requires `conversationId` (a UUID string from the browser).

For full endpoint contracts and implementation details, see [CLAUDE.md](CLAUDE.md).

---

## Project Structure

```
the-ai-cookbook/
├── ai-cookbook-java-backend/        # Java backend
│   ├── build.gradle
│   ├── Dockerfile
│   └── src/main/
│       ├── java/in/ai/chatbot/      # Controllers, services, config, models
│       └── resources/
│           ├── application.yaml             # Anthropic configuration
│           └── db/migration/                # Flyway migrations (V1–V3)
│
├── ai-cookbook-backend/             # FastAPI endpoint-compatible backend
│   ├── app/                         # Routers, services, providers, persistence
│   └── alembic/                     # Schema-parity migrations
│
├── ai-cookbook-frontend/            # React frontend
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── App.js
│       └── components/              # One component per tab
│
├── tools/                           # Developer utilities
│   ├── generate-tests.sh            # Java test generator (Claude sub-agent)
│   ├── generate-react-tests.sh      # React test generator (Claude sub-agent)
│   ├── claude_review.py             # PR reviewer called by GitHub Actions
│   ├── generate_products.py         # Generates sample_products.xlsx
│   └── README.md                    # Tool usage guide
│
├── .github/workflows/
│   └── pr-reviewer.yml              # Automated Claude PR review
│
├── docker-compose.yaml
├── .env.example
├── AWS Deployment Strategy.md       # Future AWS deployment plan
└── CLAUDE.md                        # Developer guide for Claude Code
```

---

## Database

The backend auto-applies Flyway migrations on startup. No manual schema setup is needed.

| Migration | What it creates |
|---|---|
| `V1__init_schema.sql` | `vector_store`, `document_metadata` tables + HNSW index |
| `V2__add_conversation_memory.sql` | `conversation_messages` table |
| `V3__add_product_catalog.sql` | `product`, `product_vector_store` tables |

PostgreSQL 17 with the `pgvector` extension is required. The `pgvector/pgvector:pg17` Docker image includes it.

---

## Developer Tools

### Test Generator (local Claude sub-agent)

Generates JUnit 5 + Mockito test skeletons for Java files, or Jest + React Testing Library tests for React components. Requires the `claude` CLI installed and authenticated.

```bash
# Java
./tools/generate-tests.sh \
  ai-cookbook-java-backend/src/main/java/in/ai/chatbot/service/RagService.java

# React
./tools/generate-react-tests.sh ai-cookbook-frontend/src/components/RAGChatbot.js
```

See [tools/README.md](tools/README.md) for full usage.

### PR Code Reviewer (GitHub Actions)

`.github/workflows/pr-reviewer.yml` fires automatically on every pull request. It diffs the branch against `main`, sends the diff to Claude Haiku, and posts a structured review comment covering Spring AI patterns, security, error handling, and breaking changes.

**Setup:** Add `ANTHROPIC_API_KEY` to your repository's GitHub Secrets (Settings → Secrets and variables → Actions).

---

## Running Tests

```bash
# Backend
cd ai-cookbook-java-backend
./gradlew test

# Run a single test class
./gradlew test --tests "in.ai.chatbot.service.SomeServiceTest"

# Frontend
cd ai-cookbook-frontend
npm test
```

---

## Product Catalog — Sample Data

A 100-product sample file is included at `sample_products.xlsx`. To regenerate it:

```bash
pip install -r tools/requirements.txt
python3 tools/generate_products.py
```

Upload it via the **Product Search** tab. The XLS column contract is:
`ProductID | Name | Category | Brand | Description | Price | ImageUrl | Rating | StockCount`

---

## Deployment

An AWS free-tier deployment architecture (ECS, RDS PostgreSQL, S3 + CloudFront, Amazon Bedrock) is fully documented in [AWS Deployment Strategy.md](AWS%20Deployment%20Strategy.md). It covers Terraform infrastructure, GitHub Actions CI/CD pipelines, and an optional Bedrock Spring profile for AWS deployments.

---

## Contributing

1. Fork the repository and create a feature branch from `main`.
2. Open a pull request — the Claude PR Reviewer bot will post an automated code review within ~30 seconds.
3. Ensure the backend builds (`./gradlew bootJar`) and the frontend builds (`npm run build`) before requesting review.

For internal architecture details, bean wiring, and implementation notes, see [CLAUDE.md](CLAUDE.md).
