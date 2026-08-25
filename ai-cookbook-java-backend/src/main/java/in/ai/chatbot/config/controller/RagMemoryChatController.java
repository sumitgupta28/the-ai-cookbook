package in.ai.chatbot.config.controller;

import in.ai.chatbot.config.model.ConversationMessage;
import in.ai.chatbot.config.model.ConversationSummary;
import in.ai.chatbot.config.model.RagChatResponse;
import in.ai.chatbot.config.service.RagMemoryService;
import in.ai.chatbot.config.service.RagService.RagContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
public class RagMemoryChatController {

    private final ChatClient memoryChatClient;
    private final RagMemoryService ragMemoryService;

    public RagMemoryChatController(@Qualifier("memoryChatClient") ChatClient memoryChatClient,
                                   RagMemoryService ragMemoryService) {
        this.memoryChatClient = memoryChatClient;
        this.ragMemoryService = ragMemoryService;
    }

    @GetMapping(value = "/rag/memory/ai/chat/string/client", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> generateWithMemory(
            @RequestParam("message") String message,
            @RequestParam("conversationId") String conversationId,
            @RequestParam(value = "topK", defaultValue = "5") int topK,
            @RequestParam(value = "similarityThreshold", defaultValue = "0.0") double similarityThreshold,
            @RequestParam(value = "mode", defaultValue = "soft") String mode,
            @RequestParam(value = "temperature", defaultValue = "0.7") double temperature,
            @RequestParam(value = "maxTokens", defaultValue = "1000") int maxTokens) {

        log.debug("[/rag/memory] conversationId={} message='{}'", conversationId, message);

        RagContext ctx = ragMemoryService.buildRagContext(message, topK, similarityThreshold, mode);

        if (ctx.shortCircuit()) {
            return Flux.just(ctx.shortCircuitMessage());
        }

        ChatOptions options = ChatOptions.builder()
                .temperature(temperature)
                .maxTokens(maxTokens)
                .build();

        var promptSpec = memoryChatClient.prompt()
                .options(options)
                .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId));

        if (ctx.systemPrompt() != null && !ctx.systemPrompt().isBlank()) {
            promptSpec = promptSpec.system(ctx.systemPrompt());
        }

        return promptSpec
                .user(message)
                .stream()
                .content()
                .doOnComplete(() -> log.debug("[/rag/memory] stream completed for {}", conversationId))
                .doOnError(e -> log.debug("[/rag/memory] stream error: {}", e.getMessage()));
    }

    @PostMapping(value = "/rag/memory/ai/chat/json/client", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> generateJsonWithMemory(
            @RequestParam("message") String message,
            @RequestParam("conversationId") String conversationId,
            @RequestParam(value = "topK", defaultValue = "5") int topK,
            @RequestParam(value = "similarityThreshold", defaultValue = "0.0") double similarityThreshold,
            @RequestParam(value = "mode", defaultValue = "soft") String mode,
            @RequestParam(value = "temperature", defaultValue = "0.7") double temperature,
            @RequestParam(value = "maxTokens", defaultValue = "1000") int maxTokens) {

        log.debug("[/rag/memory/json] conversationId={} message='{}'", conversationId, message);
        RagContext ctx = ragMemoryService.buildRagContext(message, topK, similarityThreshold, mode);

        if (ctx.shortCircuit()) {
            return ResponseEntity.ok(new RagChatResponse(
                    ctx.shortCircuitMessage(), conversationId, false, mode, List.of()));
        }

        try {
            ChatOptions options = ChatOptions.builder()
                    .temperature(temperature)
                    .maxTokens(maxTokens)
                    .build();

            var promptSpec = memoryChatClient.prompt()
                    .options(options)
                    .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId));

            if (ctx.systemPrompt() != null && !ctx.systemPrompt().isBlank()) {
                promptSpec = promptSpec.system(ctx.systemPrompt());
            }

            String answer = promptSpec.user(message).call().content();

            return ResponseEntity.ok(new RagChatResponse(
                    answer,
                    conversationId,
                    !ctx.sources().isEmpty(),
                    mode,
                    ctx.sources()
            ));
        } catch (Exception e) {
            log.error("[/rag/memory/json] error: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to generate response", "detail", e.getMessage()));
        }
    }

    @DeleteMapping("/rag/memory/ai/chat/conversation/{conversationId}")
    public ResponseEntity<Void> clearConversation(@PathVariable String conversationId) {
        ragMemoryService.clearConversation(conversationId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/rag/memory/conversations")
    public List<ConversationSummary> listConversations() {
        return ragMemoryService.listConversations();
    }

    @GetMapping("/rag/memory/conversations/{conversationId}/messages")
    public List<ConversationMessage> getConversationMessages(@PathVariable String conversationId) {
        return ragMemoryService.getConversationMessages(conversationId);
    }
}
