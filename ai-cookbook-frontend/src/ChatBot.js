import React, { useRef, useEffect, useState } from 'react';
import { IoMdSend } from 'react-icons/io';
import { useStreamingChat } from './useStreamingChat';
import MarkdownMessage from './MarkdownMessage';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

const ChatBot = () => {
    const { messages, streaming, sendMessage } = useStreamingChat();
    const [input, setInput] = useState('');
    const chatboxRef = useRef(null);

    useEffect(() => {
        if (chatboxRef.current) {
            chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || streaming) return;
        const text = input;
        setInput('');
        sendMessage(text, `${API_BASE}/ai/chat/string?message=${encodeURIComponent(text)}`);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    return (
        <div className="flex flex-col justify-center items-center h-full bg-gray-100 p-5 box-border">

            <div className="w-full max-w-xl mb-3 px-4 py-3 bg-white rounded-xl shadow-sm border-l-4 border-indigo-400">
                <p className="text-sm font-semibold text-indigo-600 mb-0.5">Direct AI Chat</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                    Talks directly to the AI model with no document context — answers come entirely from the model's built-in knowledge.
                    Best for general questions, brainstorming, and open-ended conversation.
                </p>
            </div>

            <div
                className="bg-white w-full max-w-xl h-[55vh] rounded-xl overflow-y-auto shadow-md p-5 flex flex-col gap-2.5"
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

            <div className="flex justify-center items-center w-full max-w-xl mt-5">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    disabled={streaming}
                    className="w-full p-2.5 border border-gray-300 rounded text-base mr-2.5 focus:outline-none focus:border-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
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
    );
};

export default ChatBot;
