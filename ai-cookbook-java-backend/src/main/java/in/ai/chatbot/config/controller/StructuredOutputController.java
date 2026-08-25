package in.ai.chatbot.config.controller;

import in.ai.chatbot.config.model.EntityExtractionResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/structured")
@RequiredArgsConstructor
public class StructuredOutputController {

    private final ChatClient chatClient;

    private static final String SYSTEM_PROMPT = """
            You are an entity extraction assistant.
            Extract all named entities from the user's text.
            You MUST respond with ONLY a valid JSON object — no preamble, no explanation, no markdown.
            Use exactly these keys: people, organizations, locations, dates, topics.
            Each value must be a JSON array of strings.
            If a category has no entities, return an empty array [].
            """;

    @GetMapping("/extract")
    public ResponseEntity<?> extract(@RequestParam("message") String message) {
        log.debug("[/structured/extract] message='{}'", message);
        try {
            EntityExtractionResult result = chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user(message)
                    .call()
                    .entity(EntityExtractionResult.class);
            log.debug("[/structured/extract] result='{}'", result);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("[/structured/extract] Structured output failed: {}", e.getMessage(), e);
            return ResponseEntity.unprocessableEntity()
                    .body(new ErrorResponse(
                            "The model did not return valid JSON. Try rephrasing your input.",
                            e.getMessage()
                    ));
        }
    }

    record ErrorResponse(String userMessage, String detail) {}
}
