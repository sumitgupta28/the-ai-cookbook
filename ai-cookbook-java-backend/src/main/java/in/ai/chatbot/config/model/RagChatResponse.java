package in.ai.chatbot.config.model;

import java.util.List;

public record RagChatResponse(
        String answer,
        String conversationId,
        boolean ragContextUsed,
        String mode,
        List<String> sources
) {}
