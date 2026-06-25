import React, { useRef, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { IoMdSend } from 'react-icons/io';
import { useStreamingChat } from './useStreamingChat';
import MarkdownMessage from './MarkdownMessage';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

const GradientSlider = ({ label, value, min, max, step, onChange, formatValue, disabled }) => {
    const pct = ((value - min) / (max - min)) * 100;

    const trackStyle = {
        background: `linear-gradient(to right,
            #e53e3e 0%,
            #dd6b20 20%,
            #d69e2e 40%,
            #a0c334 60%,
            #48bb78 80%,
            #2f855a 100%)`
    };

    const thumbColor =
        pct < 20 ? '#e53e3e' :
        pct < 40 ? '#dd6b20' :
        pct < 60 ? '#d69e2e' :
        pct < 80 ? '#a0c334' : '#48bb78';

    return (
        <div className="mb-6">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-gray-700">{label}</span>
                <span
                    className="text-sm font-bold px-2 py-0.5 rounded-full text-white min-w-[2.5rem] text-center"
                    style={{ backgroundColor: thumbColor }}
                >
                    {formatValue ? formatValue(value) : value}
                </span>
            </div>

            <div className="relative h-3 rounded-full mt-3" style={trackStyle}>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    disabled={disabled}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    style={{ margin: 0 }}
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-md pointer-events-none transition-all"
                    style={{ left: `calc(${pct}% - 10px)`, backgroundColor: thumbColor }}
                />
                <div
                    className="absolute pointer-events-none"
                    style={{ left: `calc(${pct}% - 6px)`, top: '-16px' }}
                >
                    <div style={{
                        width: 0, height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: `8px solid ${thumbColor}`
                    }} />
                </div>
            </div>

            <div className="flex justify-between mt-2">
                <span className="text-xs text-gray-400">{min}</span>
                <span className="text-xs text-gray-400">{max}</span>
            </div>
        </div>
    );
};

const ModeToggle = ({ value, onChange, disabled }) => (
    <div className="mb-6">
        <span className="text-sm font-semibold text-gray-700 block mb-2">RAG Mode</span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {['soft', 'strict'].map((m) => (
                <button
                    key={m}
                    onClick={() => onChange(m)}
                    disabled={disabled}
                    className={`flex-1 py-1.5 text-sm font-medium transition-colors capitalize disabled:opacity-60 disabled:cursor-not-allowed ${
                        value === m
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    {m}
                </button>
            ))}
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
            {value === 'soft'
                ? 'Uses docs + falls back to general knowledge'
                : 'Answers strictly from indexed documents only'}
        </p>
    </div>
);

const formatSessionDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const SessionItem = ({ session, isActive, onLoad, onDelete }) => {
    const preview = session.preview
        ? (session.preview.length > 48 ? session.preview.slice(0, 48) + '…' : session.preview)
        : 'Empty session';
    const shortId = session.conversationId.slice(-6);
    const dateStr = formatSessionDate(session.lastActivity);

    return (
        <div
            onClick={onLoad}
            className={`relative p-2.5 rounded-lg border cursor-pointer group transition-colors ${
                isActive
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
            }`}
        >
            <p className="text-xs text-gray-700 leading-snug pr-4">{preview}</p>
            <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs font-mono text-gray-400">…{shortId}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">{dateStr}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">{session.messageCount} msgs</span>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(session.conversationId); }}
                title="Delete session"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-base leading-none"
            >
                ×
            </button>
        </div>
    );
};

const RAGChatbotWithMemory = () => {
    const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
    const [input, setInput] = useState('');
    const [mode, setMode] = useState('soft');
    const [similarityThreshold, setSimilarityThreshold] = useState(0.0);
    const [topK, setTopK] = useState(5);
    const [temperature, setTemperature] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(1000);
    const [sessions, setSessions] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const chatboxRef = useRef(null);

    const fetchSessions = useCallback(async () => {
        setLoadingSessions(true);
        try {
            const res = await axios.get(`${API_BASE}/rag/memory/conversations`);
            setSessions(res.data);
        } catch (e) {
            // silently ignore
        } finally {
            setLoadingSessions(false);
        }
    }, []);

    const { messages, setMessages, streaming, sendMessage } = useStreamingChat({ onComplete: fetchSessions });

    useEffect(() => {
        if (chatboxRef.current) {
            chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const handleSend = () => {
        if (!input.trim() || streaming) return;
        const text = input;
        setInput('');
        const url = `${API_BASE}/rag/memory/ai/chat/string/client` +
            `?message=${encodeURIComponent(text)}` +
            `&conversationId=${encodeURIComponent(conversationId)}` +
            `&topK=${topK}` +
            `&similarityThreshold=${similarityThreshold}` +
            `&mode=${mode}` +
            `&temperature=${temperature}` +
            `&maxTokens=${maxTokens}`;
        sendMessage(text, url);
    };

    const startNewConversation = () => {
        setConversationId(crypto.randomUUID());
        setMessages([]);
        fetchSessions();
    };

    const loadSession = async (sessionId) => {
        if (sessionId === conversationId) return;
        try {
            const res = await axios.get(`${API_BASE}/rag/memory/conversations/${encodeURIComponent(sessionId)}/messages`);
            const loaded = res.data
                .filter(m => m.role === 'USER' || m.role === 'ASSISTANT')
                .map(m => ({
                    id: crypto.randomUUID(),
                    text: m.content,
                    sender: m.role === 'USER' ? 'user' : 'ai'
                }));
            setConversationId(sessionId);
            setMessages(loaded);
        } catch (e) {
            console.error('Failed to load session', e);
        }
    };

    const deleteSession = async (sessionId) => {
        try {
            await axios.delete(`${API_BASE}/rag/memory/ai/chat/conversation/${encodeURIComponent(sessionId)}`);
            setSessions(prev => prev.filter(s => s.conversationId !== sessionId));
            if (sessionId === conversationId) {
                setConversationId(crypto.randomUUID());
                setMessages([]);
            }
        } catch (e) {
            console.error('Failed to delete session', e);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    const shortId = conversationId.slice(-8);

    return (
        <div className="flex h-full bg-gray-100 overflow-hidden">

            {/* Left — Settings + Sessions panel */}
            <div className="w-72 min-w-[18rem] bg-white border-r border-gray-200 p-6 flex flex-col shadow-sm overflow-y-auto">
                <h2 className="text-base font-bold text-indigo-600 mb-1 tracking-wide uppercase">RAG + Memory</h2>
                <p className="text-xs text-gray-400 mb-5">Tune retrieval & generation per query</p>

                {/* Active session */}
                <div className="mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">Active Session</span>
                        <span className="text-xs font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                            …{shortId}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Window: last 20 msgs</span>
                        <button
                            onClick={startNewConversation}
                            disabled={streaming}
                            className="text-xs px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            + New Session
                        </button>
                    </div>
                </div>

                {/* Past sessions */}
                <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Past Sessions</span>
                        {loadingSessions
                            ? <span className="text-xs text-gray-400">Loading…</span>
                            : <span className="text-xs text-gray-400">{sessions.length}</span>
                        }
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                        {sessions.length === 0 && !loadingSessions ? (
                            <p className="text-xs text-gray-400 italic px-1 py-2">No saved sessions yet</p>
                        ) : (
                            sessions.map(s => (
                                <SessionItem
                                    key={s.conversationId}
                                    session={s}
                                    isActive={s.conversationId === conversationId}
                                    onLoad={() => loadSession(s.conversationId)}
                                    onDelete={deleteSession}
                                />
                            ))
                        )}
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-5">
                    <ModeToggle value={mode} onChange={setMode} disabled={streaming} />

                    <div className="border-t border-gray-100 pt-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Retrieval</p>

                        <GradientSlider
                            label="Similarity Threshold"
                            value={similarityThreshold}
                            min={0.0}
                            max={1.0}
                            step={0.05}
                            onChange={setSimilarityThreshold}
                            formatValue={(v) => v.toFixed(2)}
                            disabled={streaming}
                        />

                        <GradientSlider
                            label="Top K"
                            value={topK}
                            min={1}
                            max={20}
                            step={1}
                            onChange={setTopK}
                            disabled={streaming}
                        />
                    </div>

                    <div className="border-t border-gray-100 pt-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Generation</p>

                        <GradientSlider
                            label="Temperature"
                            value={temperature}
                            min={0.0}
                            max={1.0}
                            step={0.1}
                            onChange={setTemperature}
                            formatValue={(v) => v.toFixed(1)}
                            disabled={streaming}
                        />

                        <GradientSlider
                            label="Max Tokens"
                            value={maxTokens}
                            min={100}
                            max={2000}
                            step={100}
                            onChange={setMaxTokens}
                            disabled={streaming}
                        />
                    </div>
                </div>

                <div className="mt-auto pt-5 border-t border-gray-100">
                    <p className="text-xs text-gray-400 leading-relaxed space-y-1">
                        <span className="block"><strong className="text-gray-500">Threshold:</strong> min similarity for a chunk to be included</span>
                        <span className="block"><strong className="text-gray-500">Top K:</strong> max chunks retrieved per query</span>
                        <span className="block"><strong className="text-gray-500">Temperature:</strong> low = factual, high = creative</span>
                        <span className="block"><strong className="text-gray-500">Max Tokens:</strong> caps the response length</span>
                    </p>
                </div>
            </div>

            {/* Right — Chat area */}
            <div className="flex flex-col flex-1 p-6 min-w-0">

                <div className="mb-3 px-4 py-3 bg-white rounded-xl shadow-sm border-l-4 border-purple-400 flex-shrink-0">
                    <p className="text-sm font-semibold text-purple-600 mb-0.5">RAG-Powered Chat with Memory</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Each query searches your indexed documents <strong>and</strong> remembers your conversation history (last 20 messages).
                        Click <strong>+ New Session</strong> to start fresh, or pick a past session from the left panel to continue it.
                    </p>
                </div>

                <div
                    className="bg-white rounded-xl overflow-y-auto shadow-md p-5 flex flex-col gap-2.5 flex-shrink-0"
                    style={{ height: '55vh' }}
                    ref={chatboxRef}
                    role="log"
                    aria-live="polite"
                    aria-atomic="false"
                >
                    {messages.length === 0 && (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-sm text-gray-400 italic">Start chatting or load a past session from the left panel</p>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex items-start ${msg.sender === 'user' ? 'justify-end' : ''}`}
                        >
                            {msg.sender === 'ai' && (
                                <img src="/ai-assistant.png" alt="AI Avatar" className="w-10 h-10 rounded-full mr-2.5 flex-shrink-0" />
                            )}
                            <div
                                className={`max-w-[80%] px-3 py-2.5 rounded-xl text-base leading-relaxed break-words my-1.5 ${
                                    msg.sender === 'user'
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-gray-200 text-black'
                                }`}
                            >
                                {msg.sender === 'user' ? msg.text : <MarkdownMessage text={msg.text} />}
                                {msg.streaming && (
                                    <span className="inline-block w-0.5 h-4 bg-gray-500 ml-0.5 align-middle animate-pulse" />
                                )}
                            </div>
                            {msg.sender === 'user' && (
                                <img src="/user-icon.png" alt="User Avatar" className="w-10 h-10 rounded-full ml-2.5 flex-shrink-0" />
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex items-center mt-4">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message..."
                        disabled={streaming}
                        className="flex-1 p-2.5 border border-gray-300 rounded text-base mr-2.5 focus:outline-none focus:border-purple-400 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                        onClick={handleSend}
                        disabled={streaming}
                        aria-label="Send message"
                        className="bg-purple-500 text-white border-none rounded p-2.5 px-4 cursor-pointer text-base flex justify-center items-center hover:bg-purple-600 active:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                        <IoMdSend size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RAGChatbotWithMemory;
