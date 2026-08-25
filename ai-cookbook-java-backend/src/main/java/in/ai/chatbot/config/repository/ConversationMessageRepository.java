package in.ai.chatbot.config.repository;

import in.ai.chatbot.config.model.ConversationMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {

    List<ConversationMessage> findByConversationIdOrderByMessageIndexAsc(String conversationId);

    @Modifying
    @Query("DELETE FROM ConversationMessage c WHERE c.conversationId = :conversationId")
    void deleteByConversationId(@Param("conversationId") String conversationId);

    @Query("SELECT DISTINCT c.conversationId FROM ConversationMessage c")
    List<String> findDistinctConversationIds();

    @Query(value = """
            SELECT cm.conversation_id,
                   MIN(cm.created_at) AS started_at,
                   MAX(cm.created_at) AS last_activity,
                   COUNT(cm.id)       AS message_count,
                   (SELECT sub.content FROM conversation_messages sub
                    WHERE sub.conversation_id = cm.conversation_id
                      AND sub.role = 'USER'
                    ORDER BY sub.message_index ASC
                    LIMIT 1)          AS preview
            FROM conversation_messages cm
            GROUP BY cm.conversation_id
            ORDER BY last_activity DESC
            """, nativeQuery = true)
    List<Object[]> findConversationSummaries();
}
