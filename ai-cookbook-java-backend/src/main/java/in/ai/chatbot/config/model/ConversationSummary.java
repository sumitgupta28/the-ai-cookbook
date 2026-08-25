package in.ai.chatbot.config.model;

import java.time.LocalDateTime;

public record ConversationSummary(
        String conversationId,
        LocalDateTime startedAt,
        LocalDateTime lastActivity,
        long messageCount,
        String preview
) {}
