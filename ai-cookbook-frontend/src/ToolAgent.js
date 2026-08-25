import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { IoMdSend } from 'react-icons/io';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

const TOOLS = [
    {
        category: 'Calculator',
        icon: '🧮',
        items: [
            { name: 'add',      desc: 'Sum two numbers',           example: 'What is 237 plus 489?' },
            { name: 'subtract', desc: 'Difference of two numbers', example: 'What is 1000 minus 337?' },
            { name: 'multiply', desc: 'Product of two numbers',    example: 'What is 42 multiplied by 17?' },
            { name: 'divide',   desc: 'Quotient of two numbers',   example: 'Divide 144 by 12.' },
        ],
    },
    {
        category: 'Date & Time',
        icon: '🕐',
        items: [
            { name: 'getCurrentDateTime', desc: 'Current date and time', example: 'What day of the week is it today?' },
        ],
    },
    {
        category: 'Weather (mock)',
        icon: '🌤',
        items: [
            { name: 'getWeather', desc: 'Mock weather for a city', example: 'What is the weather like in Tokyo?' },
        ],
    },
];

const ToolAgent = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput]       = useState('');
    const [loading, setLoading]   = useState(false);
    const chatboxRef              = useRef(null);

    useEffect(() => {
        if (chatboxRef.current) {
            chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async (text) => {
        const msg = text ?? input;
        if (!msg.trim()) return;

        setMessages(prev => [...prev, { id: crypto.randomUUID(), text: msg, sender: 'user' }]);
        setInput('');
        setLoading(true);

        try {
            const response = await axios.get(
                `${API_BASE}/tool/ai/chat/string?message=${encodeURIComponent(msg)}`
            );
            setMessages(prev => [...prev, { id: crypto.randomUUID(), text: response.data, sender: 'ai' }]);
        } catch (error) {
            console.error('Tool agent error:', error);
            setMessages(prev => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    text: 'Error: could not reach the tool agent. Make sure the backend is running with the Anthropic profile (--spring.profiles.active=anthropic).',
                    sender: 'ai',
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') sendMessage();
    };

    return (
        <div className="flex h-full bg-gray-100 overflow-hidden">

            {/* ── Left sidebar: Available Tools ───────────────────────────── */}
            <div className="w-72 min-w-[18rem] bg-white border-r border-gray-200 p-6 flex flex-col shadow-sm overflow-y-auto">
                <h2 className="text-base font-bold text-indigo-600 mb-1 tracking-wide uppercase">Available Tools</h2>
                <p className="text-xs text-gray-400 mb-4">Click an example to send it instantly</p>

                {TOOLS.map((group) => (
                    <div key={group.category} className="mb-5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                            {group.icon} {group.category}
                        </p>
                        <div className="space-y-2">
                            {group.items.map((tool) => (
                                <div key={tool.name} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                    <p className="text-xs font-semibold text-gray-700 mb-0.5">{tool.name}()</p>
                                    <p className="text-xs text-gray-400 mb-2">{tool.desc}</p>
                                    <button
                                        onClick={() => sendMessage(tool.example)}
                                        disabled={loading}
                                        className="w-full text-left text-xs text-indigo-500 bg-indigo-50 hover:bg-indigo-100 px-2 py-1.5 rounded border border-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors leading-relaxed"
                                    >
                                        "{tool.example}"
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Profile warning — always visible */}
                <div className="mt-auto pt-4 border-t border-gray-100">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Requires Anthropic profile</p>
                        <p className="text-xs text-amber-600 leading-relaxed">
                            Tool calling is not supported by Ollama. Start the backend with:
                        </p>
                        <code className="block text-xs text-amber-800 bg-amber-100 rounded mt-1.5 px-2 py-1 break-all">
                            --spring.profiles.active=anthropic
                        </code>
                    </div>
                </div>
            </div>

            {/* ── Right: Chat area ────────────────────────────────────────── */}
            <div className="flex flex-col flex-1 p-6 min-w-0">

                {/* Summary banner */}
                <div className="mb-3 px-4 py-3 bg-white rounded-xl shadow-sm border-l-4 border-indigo-400 flex-shrink-0">
                    <p className="text-sm font-semibold text-indigo-600 mb-0.5">Tool-Augmented Agent</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        The LLM can invoke real functions — calculator math, current date/time, and mock weather — before composing its reply.
                        Each tool call happens server-side; the LLM decides which tool to use and when.
                    </p>
                </div>

                {/* Chat box */}
                <div
                    className="bg-white rounded-xl overflow-y-auto shadow-md p-5 flex flex-col gap-2.5 flex-shrink-0"
                    style={{ height: '55vh' }}
                    ref={chatboxRef}
                    role="log"
                    aria-live="polite"
                >
                    {messages.length === 0 && !loading && (
                        <p className="text-xs text-gray-400 text-center mt-10">
                            Ask a math question, request the current time, or ask about the weather in a city.
                        </p>
                    )}

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex items-start ${msg.sender === 'user' ? 'justify-end' : ''}`}
                        >
                            {msg.sender === 'ai' && (
                                <img src="/ai-assistant.png" alt="AI" className="w-10 h-10 rounded-full mr-2.5 flex-shrink-0" />
                            )}
                            <div
                                className={`max-w-[80%] px-3 py-2.5 rounded-xl text-base leading-relaxed break-words my-1.5 ${
                                    msg.sender === 'user'
                                        ? 'bg-indigo-500 text-white'
                                        : 'bg-gray-200 text-black'
                                }`}
                            >
                                {msg.text}
                            </div>
                            {msg.sender === 'user' && (
                                <img src="/user-icon.png" alt="You" className="w-10 h-10 rounded-full ml-2.5 flex-shrink-0" />
                            )}
                        </div>
                    ))}

                    {loading && (
                        <div className="flex items-start">
                            <img src="/ai-assistant.png" alt="AI" className="w-10 h-10 rounded-full mr-2.5 flex-shrink-0" />
                            <div className="max-w-[80%] px-3 py-2.5 rounded-xl text-base bg-gray-200 text-black my-1.5 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Input row */}
                <div className="flex items-center mt-4">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="e.g. What is 42 × 17? or What's the weather in Paris?"
                        disabled={loading}
                        className="flex-1 p-2.5 border border-gray-300 rounded text-base mr-2.5 focus:outline-none focus:border-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={loading}
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

export default ToolAgent;
