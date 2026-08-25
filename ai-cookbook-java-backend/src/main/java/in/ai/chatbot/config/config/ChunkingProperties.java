package in.ai.chatbot.config.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.chunking")
@Data
public class ChunkingProperties {

    /** Combined text length (chars) below which the "tiny" strategy is used (e.g. receipts). */
    private int tinyThreshold = 600;

    /** Combined text length (chars) below which the "small" strategy is used (e.g. invoices). */
    private int smallThreshold = 3000;
}
