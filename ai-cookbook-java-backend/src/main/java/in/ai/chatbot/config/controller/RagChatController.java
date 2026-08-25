package in.ai.chatbot.config.controller;

import in.ai.chatbot.config.service.RagService;
import in.ai.chatbot.config.service.RagService.RagContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
public class RagChatController {

    private final ChatModel chatModel;
    private final RagService ragService;
    private final ChatClient chatClient;

    @GetMapping("/rag/ai/chat")
    public Flux<ChatResponse> generateStream(
            @RequestParam(value = "message") String message) {
        log.debug("[/rag/ai/chat] message: '{}'", message);
        RagContext ctx = ragService.buildRagContext(message);
        if (ctx.shortCircuit()) {
            return chatModel.stream(new Prompt(new UserMessage(ctx.shortCircuitMessage())));
        }
        return chatModel.stream(buildPrompt(message, ctx.systemPrompt()))
                .doOnComplete(() -> log.debug("[/ai/chat] stream completed"))
                .doOnError(e -> log.debug("[/ai/chat] stream error: {}", e.getMessage()));
    }

    @GetMapping("/rag/ai/chat/string")
    public Flux<String> generateString(
            @RequestParam(value = "message") String message) {
        log.debug("[/rag/ai/chat/string] message: '{}'", message);
        RagContext ctx = ragService.buildRagContext(message);
        if (ctx.shortCircuit()) {
            return Flux.just(ctx.shortCircuitMessage());
        }
        return chatModel.stream(buildPrompt(message, ctx.systemPrompt()))
                .filter(cr -> cr.getResult() != null && cr.getResult().getOutput() != null)
                .map(cr -> {
                    String text = cr.getResult().getOutput().getText();
                    return text != null ? text : "";
                })
                .filter(text -> !text.isEmpty())
                .doOnComplete(() -> log.debug("[/ai/chat/string] stream completed"))
                .doOnError(e -> log.debug("[/ai/chat/string] stream error: {}", e.getMessage()));
    }

    @GetMapping(value = "/rag/ai/chat/string/client", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> generateStringWithClient(
            @RequestParam(value = "message") String message,
            @RequestParam(value = "topK", defaultValue = "5") int topK,
            @RequestParam(value = "similarityThreshold", defaultValue = "0.0") double similarityThreshold,
            @RequestParam(value = "mode", defaultValue = "soft") String mode,
            @RequestParam(value = "temperature", defaultValue = "0.7") double temperature,
            @RequestParam(value = "maxTokens", defaultValue = "1000") int maxTokens) {
        log.debug("[/rag/ai/chat/string/client] message: '{}', topK: {}, similarityThreshold: {}, mode: {}, temperature: {}, maxTokens: {}",
                message, topK, similarityThreshold, mode, temperature, maxTokens);
        RagContext ctx = ragService.buildRagContext(message, topK, similarityThreshold, mode);
        if (ctx.shortCircuit()) {
            return Flux.just(ctx.shortCircuitMessage());
        }
        ChatOptions options = ChatOptions.builder()
                .temperature(temperature)
                .maxTokens(maxTokens)
                .build();
        var promptSpec = chatClient.prompt().options(options);
        if (ctx.systemPrompt() != null && !ctx.systemPrompt().isBlank()) {
            promptSpec = promptSpec.system(ctx.systemPrompt());
        }
        return promptSpec
                .user(message)
                .stream()
                .content()
                .doOnComplete(() -> log.debug("[/rag/ai/chat/string/client] stream completed"))
                .doOnError(e -> log.debug("[/rag/ai/chat/string/client] stream error: {}", e.getMessage()));
    }

    private Prompt buildPrompt(String userMessage, String systemPrompt) {
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            return new Prompt(List.of(new SystemMessage(systemPrompt), new UserMessage(userMessage)));
        }
        return new Prompt(new UserMessage(userMessage));
    }
}
