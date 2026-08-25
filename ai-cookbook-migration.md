## Plan: Spring Boot to Python Backend Migration

Migrate the Java backend in incremental slices to a FastAPI service while keeping the current frontend and PostgreSQL/pgvector data plane intact. Use a strangler pattern so production risk stays low, prioritize endpoint parity for active UI paths first, and use Anthropic as the supported chat provider for both implementations.

**Steps**
1. Phase 0 - Baseline and contract freeze
1.1 Capture current API contract and response behavior for all active frontend endpoints from [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller) and [ai-cookbook-frontend/src](ai-cookbook-frontend/src).
1.2 Produce endpoint parity checklist with explicit fields: method, path, params, response media type, stream/non-stream behavior, error shape.
1.3 Freeze baseline test fixtures for representative requests/responses (chat, rag, rag-memory, docs, products, tools, structured output).
1.4 Define non-functional targets: p95 latency, stream first-token latency, max upload size, and acceptable semantic drift for generated responses.

2. Phase 1 - Python foundation and shared infrastructure
2.1 Create Python service skeleton with FastAPI, Uvicorn/Gunicorn, Pydantic settings, SQLAlchemy, Alembic, psycopg/pgvector, and structured logging.
2.2 Implement configuration aligned to the Anthropic defaults in [ai-cookbook-java-backend/src/main/resources/application.yaml](ai-cookbook-java-backend/src/main/resources/application.yaml).
2.3 Mirror CORS and multipart limits from [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/config/WebConfig.java](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/config/WebConfig.java).
2.4 Reuse existing PostgreSQL database and pgvector extension; keep schema compatible with V1/V2/V3 migrations in [ai-cookbook-java-backend/src/main/resources/db/migration](ai-cookbook-java-backend/src/main/resources/db/migration).
2.5 Stand up Anthropic chat provider abstraction first; retain the interface so a future provider can be introduced without API refactor.

3. Phase 2 - Data/model parity and persistence adapters
3.1 Port relational models and repositories for document metadata, conversations, and product catalog based on [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/model](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/model) and [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/repository](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/repository).
3.2 Implement vector-store adapter for both vector tables: vector_store and product_vector_store, preserving topK and threshold semantics used by RagService/ProductSearchService.
3.3 Implement conversation memory repository behavior equivalent to JdbcChatMemoryRepository full-replace writes and ordered reads from [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/memory/JdbcChatMemoryRepository.java](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/memory/JdbcChatMemoryRepository.java).
3.4 Recreate conversation summary query behavior from ConversationMessageRepository (startedAt, lastActivity, messageCount, preview).

4. Phase 3 - Service-layer migration by bounded context
4.1 Migrate RAG core first: context builder, mode handling (soft/strict), source extraction, short-circuit behavior mirroring [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/RagService.java](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/RagService.java).
4.2 Migrate document ingestion pipeline: file parse, adaptive chunking thresholds, embedding, vector insert, metadata persistence from [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/IngestionService.java](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/IngestionService.java) and [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/config/ChunkingProperties.java](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/config/ChunkingProperties.java).
4.3 Migrate RAG memory orchestration and conversation lifecycle from [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/RagMemoryService.java](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/RagMemoryService.java).
4.4 Migrate product ingestion/search pipeline with XLS parsing and vector sync semantics from [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/ProductIngestionService.java](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/ProductIngestionService.java) and [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/ProductSearchService.java](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/ProductSearchService.java).
4.5 Migrate tool-calling and structured-output capabilities for Anthropic parity from [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/ToolChatController.java](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/ToolChatController.java), [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/tools](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/tools), and [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/StructuredOutputController.java](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/StructuredOutputController.java).
4.6 Migrate chunk-analysis lab endpoint and strategy behaviors from [ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/ChunkAnalysisController.java](ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/ChunkAnalysisController.java).

5. Phase 4 - API surface parity and compatibility routing
5.1 Implement endpoint-compatible routers for all existing backend paths so frontend components in [ai-cookbook-frontend/src](ai-cookbook-frontend/src) continue working without URL changes.
5.2 Ensure streaming endpoints replicate text/event-stream behavior for token streams (chat, rag, rag-memory where applicable).
5.3 Preserve request parameter names/defaults for topK, similarityThreshold, mode, temperature, maxTokens, and conversationId.
5.4 Preserve JSON response schemas for RagChatResponse, EntityExtractionResult, ProductUploadResult, DocumentInfo, ConversationSummary, and ConversationMessage.
5.5 Add compatibility error mapping to mimic current HTTP status and message shape for upload failures, bad params, and provider errors.

6. Phase 5 - Strangler deployment and traffic migration
6.1 Deploy Python service alongside Java service in docker-compose with independent port and health checks.
6.2 Place a gateway/routing layer (or frontend env-switch) that can route endpoint groups to Java or Python during canary.
6.3 Migrate traffic in slices: documents/product admin APIs first, then RAG endpoints, then memory endpoints, then tool/structured endpoints.
6.4 Add rollback switches per endpoint group so traffic can revert to Java instantly.
6.5 After parity sign-off, retire Java routes progressively and keep DB schema stable during transition.

7. Phase 6 - Verification, hardening, and cutover
7.1 Run contract tests against Java and Python for each endpoint with same fixtures; compare status, schema, and stream framing.
7.2 Run semantic regression checks for RAG answers with tolerance bands (exact match not required, but source usage and mode compliance required).
7.3 Run performance tests for streaming first-byte latency and upload/embedding throughput.
7.4 Run data integrity checks across relational and vector tables for ingest/delete idempotency.
7.5 Conduct staged cutover (10%/50%/100%) with observability gates; complete post-cutover monitoring window before decommissioning Java.

**Parallelization and dependencies**
1. Blocks: Phase 0 blocks all later phases; Phase 1 blocks Phases 2-4; Phase 4 blocks full traffic migration in Phase 5.
2. Parallelizable after Phase 1: Phase 2 and Phase 3 can progress together by separate engineers.
3. Parallelizable within Phase 3: document pipeline, product pipeline, and tool/structured pipeline can run in parallel; RAG memory depends on core RAG completion.
4. Parallelizable in Phase 6: contract tests and performance tests can run in parallel; cutover requires both green.

**Relevant files**
- /Users/462760/IdeaProjects/the-ai-cookbook/CLAUDE.md - Source-of-truth feature map, endpoint inventory, and architecture notes to preserve.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/build.gradle - Dependency map to translate into Python libraries.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/resources/application.yaml - Anthropic runtime configuration, database, vector settings, and multipart limits.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/resources/db/migration/V1__init_schema.sql - Base schema including vector_store and document metadata.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/resources/db/migration/V2__add_conversation_memory.sql - Conversation memory schema.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/resources/db/migration/V3__add_product_catalog.sql - Product relational + vector schema.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/ChatController.java - Direct chat endpoint semantics and streaming behavior.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/RagChatController.java - RAG endpoint behavior and tuning params.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/RagMemoryChatController.java - Conversation-scoped RAG memory endpoints.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/DocumentController.java - Document upload/list/delete/verify contract.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/ProductController.java - Product upload/search/list/delete contract.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/ToolChatController.java - Anthropic tool-calling endpoint behavior.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/StructuredOutputController.java - Structured entity extraction contract.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/controller/ChunkAnalysisController.java - Chunking strategy lab contract.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/RagService.java - RAG context assembly, mode logic, source handling.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/RagMemoryService.java - Memory lifecycle orchestration.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/IngestionService.java - Tika/chunk/embed/store pipeline.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/ProductIngestionService.java - XLS import and embedding semantics.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/service/ProductSearchService.java - Product similarity search behavior.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/memory/JdbcChatMemoryRepository.java - Conversation persistence contract for window memory.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/config/EmbeddingConfig.java - ONNX embedding model and dimension constraints.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/config/ProductVectorStoreConfig.java - Second vector store table wiring.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-java-backend/src/main/java/in/ai/chatbot/config/config/WebConfig.java - CORS policy parity.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-frontend/src/ChatBot.js - Existing frontend dependency on direct chat endpoint.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-frontend/src/RAGChatbot.js - Existing frontend dependency on RAG endpoint.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-frontend/src/RAGChatbotWithMemory.js - Existing frontend dependency on conversation memory endpoints.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-frontend/src/DocumentUpload.js - Existing frontend dependency on document APIs.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-frontend/src/ProductSearch.js - Existing frontend dependency on product APIs.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-frontend/src/ToolAgent.js - Existing frontend dependency on tool endpoint.
- /Users/462760/IdeaProjects/the-ai-cookbook/ai-cookbook-frontend/src/StructuredOutput.js - Existing frontend dependency on structured output endpoint.
- /Users/462760/IdeaProjects/the-ai-cookbook/docker-compose.yaml - Side-by-side deployment and routing orchestration during strangler rollout.

**Verification**
1. Contract parity tests: endpoint-by-endpoint Java vs Python comparisons for method, status code, headers, and response schema.
2. Streaming verification: confirm text/event-stream framing and token cadence for chat and rag stream endpoints.
3. RAG behavior checks: validate strict mode no-context short-circuit and soft mode fallback semantics against baseline fixtures.
4. Memory checks: verify conversation window truncation, ordering by message_index, clear conversation endpoint behavior, and summary previews.
5. Ingestion checks: upload PDF/DOCX/TXT and XLS samples, verify relational rows and vector rows are both created/deleted correctly.
6. Tool/structured checks: confirm Anthropic tool invocation loop and typed entity extraction schema compliance.
7. Performance checks: p95 latency, stream first-token time, and ingestion throughput under concurrent uploads.
8. Migration safety checks: canary routing logs, rollback drill success, and no schema drift during mixed Java/Python traffic.

**Decisions**
- Chosen framework: FastAPI.
- Chosen rollout model: Strangler pattern with side-by-side Java and Python.
- Chosen provider scope: Anthropic only for both current backend implementations.
- Included scope: full backend feature parity for endpoints listed in CLAUDE.md plus chunking lab endpoint.
- Excluded scope: alternative chat-provider runtime support; any future provider must be introduced as an explicit product decision.

**Further Considerations**
1. Embedding parity risk: decide whether to match Java ONNX embeddings exactly or accept controlled drift using sentence-transformers defaults.
2. Vector search parity risk: define exact threshold interpretation and distance-to-similarity conversion tests early to prevent subtle ranking regressions.
3. Routing strategy: choose between reverse-proxy route splitting and frontend base-URL switching; reverse-proxy is safer for transparent strangler migration.