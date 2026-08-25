import React, { useRef, useEffect, useState } from 'react';
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

const RAGChatbot = () => {
    const [input, setInput] = useState('');
    const [mode, setMode] = useState('soft');
    const [similarityThreshold, setSimilarityThreshold] = useState(0.0);
    const [topK, setTopK] = useState(5);
    const [temperature, setTemperature] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(1000);
    const chatboxRef = useRef(null);

    const { messages, streaming, sendMessage } = useStreamingChat();

    useEffect(() => {
        if (chatboxRef.current) {
            chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || streaming) return;
        const text = input;
        setInput('');
        const url = `${API_BASE}/rag/ai/chat/string/client` +
            `?message=${encodeURIComponent(text)}` +
            `&topK=${topK}` +
            `&similarityThreshold=${similarityThreshold}` +
            `&mode=${mode}` +
            `&temperature=${temperature}` +
            `&maxTokens=${maxTokens}`;
        sendMessage(text, url);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    return (
        <div className="flex h-full bg-gray-100 overflow-hidden">

            {/* Left — RAG Settings panel */}
            <div className="w-72 min-w-[18rem] bg-white border-r border-gray-200 p-6 flex flex-col shadow-sm overflow-y-auto">
                <h2 className="text-base font-bold text-indigo-600 mb-1 tracking-wide uppercase">RAG Settings</h2>
                <p className="text-xs text-gray-400 mb-5">Tune retrieval & generation per query</p>

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

                <div className="mb-3 px-4 py-3 bg-white rounded-xl shadow-sm border-l-4 border-indigo-400 flex-shrink-0">
                    <p className="text-sm font-semibold text-indigo-600 mb-0.5">RAG-Powered Chat</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Each query searches your indexed documents and injects the most relevant chunks as context before calling the AI.
                        Use the settings panel to tune retrieval depth, similarity filtering, and response style.
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
                                        ? 'bg-indigo-500 text-white'
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
                        className="flex-1 p-2.5 border border-gray-300 rounded text-base mr-2.5 focus:outline-none focus:border-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                        onClick={handleSend}
                        disabled={streaming}
                        aria-label="Send message"
                        className="bg-indigo-500 text-white border-none rounded p-2.5 px-4 cursor-pointer text-base flex justify-center items-center hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                        <IoMdSend size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RAGChatbot;
