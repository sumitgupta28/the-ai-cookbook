package in.ai.chatbot.config.service;

import in.ai.chatbot.config.model.ConversationMessage;
import in.ai.chatbot.config.model.ConversationSummary;
import in.ai.chatbot.config.repository.ConversationMessageRepository;
import in.ai.chatbot.config.service.RagService.RagContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RagMemoryService {

    private final RagService ragService;
    private final MessageWindowChatMemory messageWindowChatMemory;
    private final ConversationMessageRepository conversationMessageRepository;

    public RagContext buildRagContext(String message, int topK, double similarityThreshold, String mode) {
        return ragService.buildRagContext(message, topK, similarityThreshold, mode);
    }

    public void clearConversation(String conversationId) {
        messageWindowChatMemory.clear(conversationId);
        log.info("Cleared conversation memory for id={}", conversationId);
    }

    public List<ConversationSummary> listConversations() {
        return conversationMessageRepository.findConversationSummaries().stream()
                .map(row -> new ConversationSummary(
                        (String) row[0],
                        row[1] != null ? ((Timestamp) row[1]).toLocalDateTime() : null,
                        row[2] != null ? ((Timestamp) row[2]).toLocalDateTime() : null,
                        row[3] != null ? ((Number) row[3]).longValue() : 0L,
                        (String) row[4]
                ))
                .toList();
    }

    public List<ConversationMessage> getConversationMessages(String conversationId) {
        return conversationMessageRepository.findByConversationIdOrderByMessageIndexAsc(conversationId);
    }
}
