package in.ai.chatbot.config.model;

import java.time.LocalDateTime;

public record DocumentInfo(
        Long id,
        String filename,
        String contentType,
        Long fileSize,
        LocalDateTime uploadTime,
        int chunkCount
) {}
