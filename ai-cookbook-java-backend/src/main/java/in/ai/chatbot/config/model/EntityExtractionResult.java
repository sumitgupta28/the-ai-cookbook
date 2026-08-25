package in.ai.chatbot.config.model;

import java.util.List;

public record EntityExtractionResult(
        List<String> people,
        List<String> organizations,
        List<String> locations,
        List<String> dates,
        List<String> topics
) {}
