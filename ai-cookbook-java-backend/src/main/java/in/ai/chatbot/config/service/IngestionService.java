package in.ai.chatbot.config.service;

import in.ai.chatbot.config.config.ChunkingProperties;
import in.ai.chatbot.config.model.DocumentInfo;
import in.ai.chatbot.config.model.DocumentMetadata;
import in.ai.chatbot.config.repository.DocumentMetadataRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class IngestionService {

    private final VectorStore vectorStore;
    private final DocumentMetadataRepository repository;
    private final ChunkingProperties chunkingProperties;

    private static final List<Character> PUNCTUATION_MARKS = Arrays.asList(
            '.', ',', '!', '?', ':', ';',
            '\'', '\"', '(', ')', '[', ']',
            '{', '}', '-', '_', '/', '\\',
            '*', '@', '#', '$', '%', '^',
            '&', '~', '`', '|'
    );

    @PersistenceContext
    private EntityManager entityManager;

    public IngestionService(VectorStore vectorStore, DocumentMetadataRepository repository,
                            ChunkingProperties chunkingProperties) {
        this.vectorStore = vectorStore;
        this.repository = repository;
        this.chunkingProperties = chunkingProperties;
    }

    private TokenTextSplitter selectSplitter(String content) {
        int len = content.length();
        if (len < chunkingProperties.getTinyThreshold()) {
            log.debug("📦 Tiny document ({} chars) → tiny chunking strategy (chunkSize=128, overlap=15)", len);
            return new TokenTextSplitter(128, 30, 10, 15, true, PUNCTUATION_MARKS);
        } else if (len < chunkingProperties.getSmallThreshold()) {
            log.debug("📦 Small document ({} chars) → small chunking strategy (chunkSize=256, overlap=30)", len);
            return new TokenTextSplitter(256, 60, 25, 30, true, PUNCTUATION_MARKS);
        } else {
            log.debug("📦 Medium/large document ({} chars) → standard chunking strategy (chunkSize=512, overlap=2000)", len);
            return new TokenTextSplitter(512, 100, 50, 2000, true, PUNCTUATION_MARKS);
        }
    }

    public DocumentInfo ingest(MultipartFile file) throws Exception {
        final String filename = file.getOriginalFilename();

        // Issue Fix #6: Validate filename
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("File must have a valid filename");
        }

        // Issue Fix #7: Validate file is not empty
        if (file.isEmpty() || file.getSize() == 0) {
            throw new IllegalArgumentException("File is empty");
        }

        log.debug("Ingesting file: '{}' (size: {} bytes)", filename, file.getSize());

        ByteArrayResource resource = new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() { return filename; }
        };

        // Issue Fix #1: Validate extracted content
        TikaDocumentReader reader = new TikaDocumentReader(resource);
        List<Document> docs = reader.get();

        if (docs == null || docs.isEmpty()) {
            log.warn("⚠️ TikaDocumentReader extracted NO content from '{}'", filename);
            throw new IllegalStateException("Could not extract content from file: " + filename);
        }

        log.debug("✓ TikaDocumentReader extracted {} document(s) from '{}'", docs.size(), filename);

        // Log extracted content for debugging
        docs.forEach(d -> {
            String text = d.getText();
            log.debug("  Document content length: {} chars", text != null ? text.length() : 0);
            if (text != null && text.length() < 50) {
                log.warn("  ⚠️ Document content very short (<50 chars): '{}'", text);
            }
        });

        String combinedContent = docs.stream()
                .map(Document::getText)
                .filter(t -> t != null)
                .collect(Collectors.joining(" "));

        TokenTextSplitter splitter = selectSplitter(combinedContent);

        docs.forEach(d -> d.getMetadata().put("filename", filename));

        // Issue Fix #2: Validate chunks are not empty
        List<Document> chunks = splitter.apply(docs);

        if (chunks == null || chunks.isEmpty()) {
            log.error("❌ TokenTextSplitter created NO chunks from '{}'", filename);
            throw new IllegalStateException("Document chunking failed - no chunks produced for: " + filename);
        }

        log.debug("✓ TokenTextSplitter created {} chunk(s) from '{}'", chunks.size(), filename);

        // Validate chunks have content
        long emptyChunks = chunks.stream().filter(c -> c.getText() == null || c.getText().isBlank()).count();
        if (emptyChunks > 0) {
            log.warn("⚠️ {} out of {} chunks are empty", emptyChunks, chunks.size());
        }

        chunks.forEach(c -> c.getMetadata().put("filename", filename));

        // Issue Fix #3: Add error handling for vectorStore.add()
        try {
            vectorStore.add(chunks);
            log.info("✓ Successfully added {} chunks to VectorStore for '{}'", chunks.size(), filename);
        } catch (Exception e) {
            log.error("❌ Failed to add chunks to VectorStore for '{}': {}", filename, e.getMessage(), e);
            throw new RuntimeException("VectorStore ingestion failed for: " + filename, e);
        }

        DocumentMetadata saved = repository.save(
                DocumentMetadata.builder()
                        .filename(filename)
                        .contentType(file.getContentType())
                        .fileSize(file.getSize())
                        .chunkCount(chunks.size())
                        .build()
        );

        log.info("✓ Document '{}' ingested successfully: {} chunks stored in VectorStore", filename, chunks.size());
        return toDto(saved);
    }

    public List<DocumentInfo> listDocuments() {
        return repository.findAllByOrderByUploadTimeDesc()
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public void deleteDocument(Long id) {
        repository.findById(id).ifPresent(doc -> {
            entityManager.createNativeQuery(
                    "DELETE FROM vector_store WHERE metadata->>'filename' = :filename"
            ).setParameter("filename", doc.getFilename()).executeUpdate();
            repository.deleteById(id);
            log.debug("Deleted document id={} ({})", id, doc.getFilename());
        });
    }

    private DocumentInfo toDto(DocumentMetadata m) {
        return new DocumentInfo(m.getId(), m.getFilename(), m.getContentType(),
                m.getFileSize(), m.getUploadTime(), m.getChunkCount());
    }
}
