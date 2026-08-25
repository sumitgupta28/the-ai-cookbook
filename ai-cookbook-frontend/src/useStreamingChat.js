import { useState, useRef, useEffect, useCallback } from 'react';

export function useStreamingChat({ onComplete } = {}) {
    const [messages, setMessages] = useState([]);
    const [streaming, setStreaming] = useState(false);
    const abortRef = useRef(null);

    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    const sendMessage = useCallback(async (text, url) => {
        if (!text.trim()) return;

        const userMsg = { id: crypto.randomUUID(), text, sender: 'user' };
        const aiMsgId = crypto.randomUUID();
        const aiMsg   = { id: aiMsgId, text: '', sender: 'ai', streaming: true };

        setMessages(prev => [...prev, userMsg, aiMsg]);
        setStreaming(true);

        abortRef.current = new AbortController();

        const decoder = new TextDecoder();
        let buffer = '';

        const appendToken = (token) => {
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, text: m.text + token } : m
            ));
        };

        const finalize = (errorText) => {
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId
                    ? { ...m, text: errorText !== undefined ? (m.text || errorText) : m.text, streaming: false }
                    : m
            ));
            setStreaming(false);
        };

        try {
            const response = await fetch(url, {
                headers: { Accept: 'text/event-stream' },
                signal: abortRef.current.signal,
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const reader = response.body.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Split on SSE event separator \n\n
                const parts = buffer.split('\n\n');
                buffer = parts.pop(); // keep incomplete trailing segment

                for (const part of parts) {
                    // SSE spec: a single event's multiple `data:` lines are re-joined with '\n'.
                    // Spring encodes newline-containing tokens as multiple data lines, so this
                    // restores the line breaks markdown tables/headings/lists depend on.
                    const data = part
                        .split('\n')
                        .filter(line => line.startsWith('data:'))
                        .map(line => line.slice(5))
                        .join('\n');
                    if (data) appendToken(data);
                }
            }

            // Flush remaining decoder bytes
            const trailing = decoder.decode();
            if (trailing) buffer += trailing;
            if (buffer) {
                const data = buffer
                    .split('\n')
                    .filter(line => line.startsWith('data:'))
                    .map(line => line.slice(5))
                    .join('\n');
                if (data) appendToken(data);
            }

            finalize();
            onComplete?.();
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Streaming error:', err);
            finalize('Sorry, something went wrong. Please try again.');
        }
    }, [onComplete]);

    return { messages, setMessages, streaming, sendMessage };
}
