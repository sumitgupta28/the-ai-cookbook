CREATE TABLE IF NOT EXISTS conversation_messages (
    id              BIGSERIAL    PRIMARY KEY,
    conversation_id VARCHAR(36)  NOT NULL,
    message_index   INTEGER      NOT NULL,
    role            VARCHAR(20)  NOT NULL,
    content         TEXT         NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_id
    ON conversation_messages (conversation_id, message_index);
