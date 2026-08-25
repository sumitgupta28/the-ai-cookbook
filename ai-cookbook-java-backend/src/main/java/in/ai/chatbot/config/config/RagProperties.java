package in.ai.chatbot.config.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.rag")
@Data
public class RagProperties {

    private String mode = "soft";
    private int topK = 5;
    private double similarityThreshold = 0.0;

}
