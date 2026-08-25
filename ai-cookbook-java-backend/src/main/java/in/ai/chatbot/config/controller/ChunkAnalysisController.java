package in.ai.chatbot.config.controller;

import in.ai.chatbot.config.model.ChunkAnalysisResult;
import in.ai.chatbot.config.service.ChunkAnalysisService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequestMapping("/chunking")
public class ChunkAnalysisController {

    private final ChunkAnalysisService service;

    public ChunkAnalysisController(ChunkAnalysisService service) {
        this.service = service;
    }

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> analyze(
            @RequestParam("file") MultipartFile file,
            @RequestParam("strategy") String strategy,
            @RequestParam("chunkSize") int chunkSize,
            @RequestParam(value = "overlap", defaultValue = "0") int overlap
    ) {
        if (chunkSize < 1) return ResponseEntity.badRequest().body("chunkSize must be >= 1");
        if (overlap < 0) return ResponseEntity.badRequest().body("overlap must be >= 0");
        if (!"TOKEN_TEXT".equalsIgnoreCase(strategy) && overlap >= chunkSize) {
            return ResponseEntity.badRequest().body("overlap must be less than chunkSize");
        }
        log.debug("Chunking analysis: file={}, strategy={}, chunkSize={}, overlap={}",
                file.getOriginalFilename(), strategy, chunkSize, overlap);
        try {
            ChunkAnalysisResult result = service.analyze(file, strategy, chunkSize, overlap);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            log.error("Chunking analysis failed for '{}': {}", file.getOriginalFilename(), e.getMessage(), e);
            return ResponseEntity.internalServerError().body("Analysis failed: " + e.getMessage());
        }
    }
}
