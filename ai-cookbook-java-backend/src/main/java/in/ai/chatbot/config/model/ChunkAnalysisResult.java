package in.ai.chatbot.config.model;

import java.util.ArrayList;
import java.util.List;

public record ChunkAnalysisResult(
        String filename,
        String strategy,
        int chunkSize,
        int overlap,
        int totalChunks,
        int totalChars,
        int totalEstimatedTokens,
        double avgCharsPerChunk,
        double avgEstimatedTokensPerChunk,
        int minChunkChars,
        int maxChunkChars,
        List<ChunkInfo> chunks
) {
    public static ChunkAnalysisResult build(String filename, String strategy, int chunkSize, int overlap, List<String> rawChunks) {
        List<ChunkInfo> chunkInfos = new ArrayList<>(rawChunks.size());
        for (int i = 0; i < rawChunks.size(); i++) {
            chunkInfos.add(ChunkInfo.from(i + 1, rawChunks.get(i)));
        }
        int totalChunks = chunkInfos.size();
        int totalChars = chunkInfos.stream().mapToInt(ChunkInfo::charCount).sum();
        int totalEstimatedTokens = totalChars / 4;
        double avgCharsPerChunk = totalChunks == 0 ? 0 : (double) totalChars / totalChunks;
        double avgEstimatedTokensPerChunk = totalChunks == 0 ? 0 : (double) totalEstimatedTokens / totalChunks;
        int minChunkChars = chunkInfos.stream().mapToInt(ChunkInfo::charCount).min().orElse(0);
        int maxChunkChars = chunkInfos.stream().mapToInt(ChunkInfo::charCount).max().orElse(0);
        return new ChunkAnalysisResult(filename, strategy, chunkSize, overlap, totalChunks, totalChars,
                totalEstimatedTokens, avgCharsPerChunk, avgEstimatedTokensPerChunk, minChunkChars, maxChunkChars, chunkInfos);
    }
}
