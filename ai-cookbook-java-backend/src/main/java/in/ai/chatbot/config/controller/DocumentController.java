package in.ai.chatbot.config.controller;

import in.ai.chatbot.config.model.DocumentInfo;
import in.ai.chatbot.config.service.IngestionService;
import in.ai.chatbot.config.service.RagService;
import in.ai.chatbot.config.service.RagService.VectorStoreInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/documents")
public class DocumentController {

    private final IngestionService ingestionService;
    private final RagService ragService;

    public DocumentController(IngestionService ingestionService, RagService ragService) {
        this.ingestionService = ingestionService;
        this.ragService = ragService;
    }

    @PostMapping("/upload")
    public ResponseEntity<DocumentInfo> upload(@RequestParam("file") MultipartFile file) {
        log.debug("Upload request: {}", file.getOriginalFilename());
        try {
            return ResponseEntity.ok(ingestionService.ingest(file));
        } catch (Exception e) {
            log.error("Upload failed for {}: {}", file.getOriginalFilename(), e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping
    public List<DocumentInfo> list() {
        return ingestionService.listDocuments();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        ingestionService.deleteDocument(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/verify")
    public Map<String, Object> verifyVectorStore() {
        log.debug("Verifying VectorStore content");
        int docCount = ragService.verifyVectorStoreContent("document");
        List<VectorStoreInfo> docs = ragService.listVectorStoreDocuments();
        return Map.of(
                "status", docCount >= 0 ? "ok" : "error",
                "documentsCount", docCount,
                "documents", docs
        );
    }

    @GetMapping("/verify/search")
    public Map<String, Object> verifySearch(
            @RequestParam(value = "query") String query,
            @RequestParam(value = "topK", defaultValue = "10") int topK,
            @RequestParam(value = "similarityThreshold", defaultValue = "0.0") double similarityThreshold) {
        log.debug("Search query: '{}', topK: {}, threshold: {}", query, topK, similarityThreshold);
        List<RagService.SearchResult> results = ragService.searchDocuments(query, topK, similarityThreshold);
        return Map.of(
                "query", query,
                "hitsFound", results.size(),
                "results", results
        );
    }
}
