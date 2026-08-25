package in.ai.chatbot.config.model;

import java.util.List;

public record ProductUploadResult(int imported, int skipped, List<String> errors) {}
