package in.ai.chatbot.config.memory;

import in.ai.chatbot.config.model.ConversationMessage;
import in.ai.chatbot.config.repository.ConversationMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class JdbcChatMemoryRepository implements ChatMemoryRepository {

    private final ConversationMessageRepository repository;

    @Override
    public List<String> findConversationIds() {
        return repository.findDistinctConversationIds();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Message> findByConversationId(String conversationId) {
        return repository.findByConversationIdOrderByMessageIndexAsc(conversationId)
                .stream()
                .map(this::toMessage)
                .toList();
    }

    @Override
    @Transactional
    public void saveAll(String conversationId, List<Message> messages) {
        // MessageWindowChatMemory sends the full updated list; replace all rows atomically
        repository.deleteByConversationId(conversationId);
        for (int i = 0; i < messages.size(); i++) {
            Message msg = messages.get(i);
            repository.save(ConversationMessage.builder()
                    .conversationId(conversationId)
                    .messageIndex(i)
                    .role(roleOf(msg))
                    .content(msg.getText())
                    .build());
        }
        log.debug("Saved {} message(s) for conversation {}", messages.size(), conversationId);
    }

    @Override
    @Transactional
    public void deleteByConversationId(String conversationId) {
        repository.deleteByConversationId(conversationId);
        log.debug("Cleared memory for conversation {}", conversationId);
    }

    private String roleOf(Message msg) {
        return switch (msg.getMessageType()) {
            case USER -> "USER";
            case ASSISTANT -> "ASSISTANT";
            case SYSTEM -> "SYSTEM";
            default -> "UNKNOWN";
        };
    }

    private Message toMessage(ConversationMessage row) {
        return switch (row.getRole()) {
            case "USER" -> new UserMessage(row.getContent());
            case "ASSISTANT" -> new AssistantMessage(row.getContent());
            case "SYSTEM" -> new SystemMessage(row.getContent());
            default -> new UserMessage(row.getContent());
        };
    }
}
