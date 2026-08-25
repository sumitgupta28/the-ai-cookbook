package in.ai.chatbot.config.controller;

import in.ai.chatbot.config.model.ProductInfo;
import in.ai.chatbot.config.model.ProductUploadResult;
import in.ai.chatbot.config.service.ProductIngestionService;
import in.ai.chatbot.config.service.ProductSearchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/products")
public class ProductController {

    private final ProductIngestionService ingestionService;
    private final ProductSearchService searchService;

    public ProductController(ProductIngestionService ingestionService, ProductSearchService searchService) {
        this.ingestionService = ingestionService;
        this.searchService = searchService;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        try {
            ProductUploadResult result = ingestionService.ingest(file);
            log.info("Product upload: {} imported, {} skipped", result.imported(), result.skipped());
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            log.error("Product upload failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("Upload failed: " + e.getMessage());
        }
    }

    @GetMapping
    public List<ProductInfo> list() {
        return ingestionService.listProducts();
    }

    @GetMapping("/search")
    public List<ProductInfo> search(
            @RequestParam String query,
            @RequestParam(defaultValue = "10") int topK,
            @RequestParam(defaultValue = "0.0") double threshold) {
        return searchService.search(query, topK, threshold);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        ingestionService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/verify")
    public Map<String, Object> verify() {
        return searchService.verifyProductStore();
    }
}
