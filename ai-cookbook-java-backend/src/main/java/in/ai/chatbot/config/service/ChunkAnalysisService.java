package in.ai.chatbot.config.service;

import dev.langchain4j.data.document.splitter.DocumentByParagraphSplitter;
import dev.langchain4j.data.document.splitter.DocumentBySentenceSplitter;
import dev.langchain4j.data.document.splitter.DocumentByWordSplitter;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.segment.TextSegment;
import in.ai.chatbot.config.model.ChunkAnalysisResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ChunkAnalysisService {

    private static final List<Character> PUNCT = Arrays.asList(
            '.', ',', '!', '?', ':', ';', '\n'
    );

    public ChunkAnalysisResult analyze(MultipartFile file, String strategy, int chunkSize, int overlap) throws IOException {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown";
        String text = extractText(file, filename);
        log.debug("Extracted {} chars from '{}', strategy={}, chunkSize={}, overlap={}", text.length(), filename, strategy, chunkSize, overlap);

        List<String> rawChunks = splitText(text, strategy, chunkSize, overlap);
        log.debug("Strategy {} produced {} chunks from '{}'", strategy, rawChunks.size(), filename);

        int effectiveOverlap = "TOKEN_TEXT".equalsIgnoreCase(strategy) ? 0 : overlap;
        return ChunkAnalysisResult.build(filename, strategy.toUpperCase(), chunkSize, effectiveOverlap, rawChunks);
    }

    private String extractText(MultipartFile file, String filename) throws IOException {
        ByteArrayResource resource = new ByteArrayResource(file.getBytes()) {
            @Override public String getFilename() { return filename; }
        };
        TikaDocumentReader reader = new TikaDocumentReader(resource);
        return reader.get().stream()
                .map(Document::getText)
                .filter(t -> t != null && !t.isBlank())
                .collect(Collectors.joining("\n"));
    }

    private List<String> splitText(String text, String strategy, int chunkSize, int overlap) {
        return switch (strategy.toUpperCase()) {
            case "RECURSIVE" -> {
                dev.langchain4j.data.document.Document doc = dev.langchain4j.data.document.Document.from(text);
                yield DocumentSplitters.recursive(chunkSize, overlap).split(doc)
                        .stream().map(TextSegment::text).collect(Collectors.toList());
            }
            case "BY_PARAGRAPH" -> {
                dev.langchain4j.data.document.Document doc = dev.langchain4j.data.document.Document.from(text);
                yield new DocumentByParagraphSplitter(chunkSize, overlap).split(doc)
                        .stream().map(TextSegment::text).collect(Collectors.toList());
            }
            case "BY_SENTENCE" -> {
                dev.langchain4j.data.document.Document doc = dev.langchain4j.data.document.Document.from(text);
                yield new DocumentBySentenceSplitter(chunkSize, overlap).split(doc)
                        .stream().map(TextSegment::text).collect(Collectors.toList());
            }
            case "BY_WORD" -> {
                dev.langchain4j.data.document.Document doc = dev.langchain4j.data.document.Document.from(text);
                yield new DocumentByWordSplitter(chunkSize, overlap).split(doc)
                        .stream().map(TextSegment::text).collect(Collectors.toList());
            }
            case "TOKEN_TEXT" -> {
                TokenTextSplitter splitter = new TokenTextSplitter(
                        chunkSize,
                        Math.max(30, chunkSize / 4),
                        Math.max(10, chunkSize / 8),
                        10000,
                        true,
                        PUNCT
                );
                yield splitter.apply(List.of(new Document(text)))
                        .stream().map(Document::getText).collect(Collectors.toList());
            }
            default -> throw new IllegalArgumentException("Unknown strategy: " + strategy);
        };
    }
}
