package in.ai.chatbot.config.model;

public record ChunkInfo(
        int index,
        int charCount,
        int wordCount,
        int estimatedTokens,
        String contentPreview
) {
    public static ChunkInfo from(int index, String content) {
        int charCount = content.length();
        int wordCount = content.isBlank() ? 0 : content.trim().split("\\s+").length;
        int estimatedTokens = charCount / 4;
        String contentPreview = content.length() > 300 ? content.substring(0, 300) : content;
        return new ChunkInfo(index, charCount, wordCount, estimatedTokens, contentPreview);
    }
}
