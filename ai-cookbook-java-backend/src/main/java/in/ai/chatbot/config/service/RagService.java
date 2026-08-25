package in.ai.chatbot.config.service;

import in.ai.chatbot.config.config.RagProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class RagService {

    private static final String SOFT_PROMPT = """
            You are a helpful assistant.

            Relevant context from uploaded documents:
            {context}

            Instructions:
            1. If the context contains relevant information, prioritize using it and cite the source when helpful.
            2. If the context doesn't fully cover the query, supplement with your general knowledge and clarify which parts come from documents vs. general knowledge.
            3. Never contradict information in the provided documents.
            4. If uncertain, acknowledge the limitation rather than guessing.
            """;

    private static final String STRICT_PROMPT = """
            You are a helpful assistant that answers strictly from the provided document context.

            Relevant context from uploaded documents:
            {context}

            Instructions:
            1. Answer ONLY based on the context provided above.
            2. If the context contains enough information to answer the question, provide a clear answer with relevant quotes if appropriate.
            3. If the context does not contain sufficient information, reply: "I don't have information about this in the uploaded documents."
            4. Do not use general knowledge or make assumptions beyond what is explicitly in the documents.
            """;

    private final VectorStore vectorStore;
    private final RagProperties props;

    public RagService(VectorStore vectorStore, RagProperties props) {
        this.vectorStore = vectorStore;
        this.props = props;
    }

    public RagContext buildRagContext(String userMessage) {
        return buildRagContext(userMessage, props.getTopK(), props.getSimilarityThreshold(), props.getMode());
    }

    public RagContext buildRagContext(String userMessage, int topK, double similarityThreshold, String mode) {

        List<Document> hits = vectorStore.similaritySearch(
                SearchRequest.builder()
                        .query(userMessage)
                        .topK(topK)
                        .similarityThreshold(similarityThreshold)
                        .build()
        );
        log.debug("RAG [{}] {} chunk(s) found for: '{}'", mode, hits.size(), userMessage);

        boolean strict = "strict".equalsIgnoreCase(mode);

        if (hits.isEmpty()) {
            return strict
                    ? RagContext.shortCircuit("I don't have information about this in the uploaded documents.")
                    : RagContext.noSystemPrompt();
        }

        List<String> sources = hits.stream()
                .map(doc -> doc.getMetadata().getOrDefault("filename", "unknown").toString())
                .distinct()
                .toList();

        String context = hits.stream()
                .map(Document::getText)
                .collect(Collectors.joining("\n\n---\n\n"));

        String prompt = (strict ? STRICT_PROMPT : SOFT_PROMPT).replace("{context}", context);
        log.debug("RAG [{}] {}", mode, prompt);
        return RagContext.withPrompt(prompt, sources);
    }

    /**
     * Verify VectorStore content by running a test similarity search.
     * Returns the count of documents found for a given query.
     */
    public int verifyVectorStoreContent(String testQuery) {
        try {

            log.debug("Verifying vector store content: {}", testQuery);
            List<Document> hits = vectorStore.similaritySearch(
                    SearchRequest.builder()
                            .query(testQuery)
                            .topK(10)
                            .similarityThreshold(0.0)  // Use 0.0 for verification to see all potential matches
                            .build()
            );
            log.info("VectorStore verification query '{}' returned {} documents", testQuery, hits.size());
              return hits.size();
        } catch (Exception e) {
            log.error("VectorStore verification failed: {}", e.getMessage());
            return -1;
        }
    }

    /**
     * List all documents in VectorStore by querying with a generic search.
     * Returns document metadata including filenames and content preview.
     */
    public List<VectorStoreInfo> listVectorStoreDocuments() {
        try {
            List<Document> docs = vectorStore.similaritySearch(
                    SearchRequest.builder()
                            .query("*") // Wildcard to get entries
                            .topK(1000)
                            .similarityThreshold(0.0)
                            .build()
            );
            return docs.stream()
                    .map(doc -> {
                        String text = doc.getText() != null ? doc.getText() : "";
                        return new VectorStoreInfo(
                                doc.getMetadata().getOrDefault("filename", "unknown").toString(),
                                text.length(),
                                text.substring(0, Math.min(100, text.length()))
                        );
                    })
                    .distinct()
                    .toList();
        } catch (Exception e) {
            log.error("Failed to list VectorStore documents: {}", e.getMessage());
            return List.of();
        }
    }

    public List<SearchResult> searchDocuments(String query, int topK, double similarityThreshold) {
        try {
            List<Document> docs = vectorStore.similaritySearch(
                    SearchRequest.builder()
                            .query(query)
                            .topK(topK)
                            .similarityThreshold(similarityThreshold)
                            .build()
            );
            return docs.stream()
                    .map(doc -> {
                        String filename = doc.getMetadata().getOrDefault("filename", "unknown").toString();
                        Object raw = doc.getMetadata().get("distance");
                        double similarity = raw != null ? Math.round((1.0 - Double.parseDouble(raw.toString())) * 1000.0) / 1000.0 : 0.0;
                        String text = doc.getText() != null ? doc.getText() : "";
                        String preview = text.substring(0, Math.min(200, text.length()));
                        return new SearchResult(filename, similarity, preview);
                    })
                    .toList();
        } catch (Exception e) {
            log.error("Document search failed: {}", e.getMessage());
            return List.of();
        }
    }

    public record RagContext(String systemPrompt, boolean shortCircuit, String shortCircuitMessage, List<String> sources) {
        static RagContext withPrompt(String systemPrompt, List<String> sources) {
            return new RagContext(systemPrompt, false, null, sources);
        }
        static RagContext noSystemPrompt() {
            return new RagContext(null, false, null, List.of());
        }
        static RagContext shortCircuit(String message) {
            return new RagContext(null, true, message, List.of());
        }
    }

    public record VectorStoreInfo(String filename, int contentLength, String contentPreview) {}

    public record SearchResult(String filename, double similarity, String contentPreview) {}
}
