package in.ai.chatbot.config.config;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.transformers.TransformersEmbeddingModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.Map;

@Configuration
public class EmbeddingConfig {

    /**
     * Configure TransformersEmbeddingModel as the primary embedding model.
     * Uses all-MiniLM-L6-v2 ONNX model (384 dimensions) from HuggingFace.
     * This prevents OllamaEmbeddingModel from being auto-configured.
     */
    @Bean
    @Primary
    public EmbeddingModel embeddingModel() throws Exception {
        TransformersEmbeddingModel embeddingModel = new TransformersEmbeddingModel();

        // (optional) defaults to classpath:/onnx/all-MiniLM-L6-v2/tokenizer.json
        embeddingModel.setTokenizerResource("classpath:tokenizer.json");

        // (optional) defaults to classpath:/onnx/all-MiniLM-L6-v2/model.onnx
        embeddingModel.setModelResource("classpath:model.onnx");

        // (optional) defaults to ${java.io.tmpdir}/spring-ai-onnx-model
        // Only the http/https resources are cached by default.
        //embeddingModel.setResourceCacheDirectory("/tmp/onnx-zoo");

        // (optional) Set the tokenizer padding if you see an errors like:
        // "ai.onnxruntime.OrtException: Supplied array is ragged, ..."
        embeddingModel.setTokenizerOptions(Map.of("padding", "true"));

        embeddingModel.afterPropertiesSet();
        return embeddingModel;
    }
}
