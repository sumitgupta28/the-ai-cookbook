package in.ai.chatbot.config.service;

import in.ai.chatbot.config.model.ProductInfo;
import in.ai.chatbot.config.repository.ProductRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
public class ProductSearchService {

    private final VectorStore productVectorStore;
    private final ProductRepository productRepository;
    private final ProductIngestionService productIngestionService;

    public ProductSearchService(@Qualifier("productVectorStore") VectorStore productVectorStore,
                                ProductRepository productRepository,
                                ProductIngestionService productIngestionService) {
        this.productVectorStore = productVectorStore;
        this.productRepository = productRepository;
        this.productIngestionService = productIngestionService;
    }

    public List<ProductInfo> search(String query, int topK, double similarityThreshold) {
        log.debug("Product semantic search: '{}' topK={} threshold={}", query, topK, similarityThreshold);

        List<Document> hits = productVectorStore.similaritySearch(
                SearchRequest.builder()
                        .query(query)
                        .topK(topK)
                        .similarityThreshold(similarityThreshold)
                        .build()
        );

        log.debug("Vector search returned {} hits", hits.size());

        return hits.stream()
                .map(doc -> {
                    Object pid = doc.getMetadata().get("product_id");
                    if (pid == null) return null;
                    return productRepository.findByProductId(pid.toString())
                            .map(productIngestionService::toDto)
                            .orElse(null);
                })
                .filter(Objects::nonNull)
                .toList();
    }

    public Map<String, Object> verifyProductStore() {
        try {
            List<Document> docs = productVectorStore.similaritySearch(
                    SearchRequest.builder()
                            .query("product")
                            .topK(1000)
                            .similarityThreshold(0.0)
                            .build()
            );
            List<Map<String, Object>> items = docs.stream().map(doc -> {
                String productId = doc.getMetadata().getOrDefault("product_id", "unknown").toString();
                String text = doc.getText() != null ? doc.getText() : "";
                String preview = text.substring(0, Math.min(120, text.length()));
                String name = productRepository.findByProductId(productId)
                        .map(p -> p.getName())
                        .orElse("Unknown");
                return Map.<String, Object>of("productId", productId, "name", name, "contentPreview", preview);
            }).toList();
            return Map.of("status", "ok", "productCount", docs.size(), "products", items);
        } catch (Exception e) {
            log.error("Product vector store health check failed: {}", e.getMessage());
            return Map.of("status", "error", "productCount", 0, "products", List.of());
        }
    }
}
