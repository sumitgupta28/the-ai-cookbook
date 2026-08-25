import React, { useState } from 'react';
import axios from 'axios';
import { IoMdSend } from 'react-icons/io';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

const EXAMPLES = [
    {
        label: 'Company founding',
        prompt: 'Apple was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne in Cupertino, California on April 1, 1976.',
    },
    {
        label: 'Historical event',
        prompt: 'NASA astronaut Neil Armstrong landed on the Moon on July 20, 1969, during the Apollo 11 mission commanded by Buzz Aldrin.',
    },
    {
        label: 'Landmark',
        prompt: 'The Eiffel Tower in Paris was designed by Gustave Eiffel and opened on March 31, 1889, for the World Fair.',
    },
    {
        label: 'Acquisition',
        prompt: 'Microsoft acquired LinkedIn in June 2016 for $26.2 billion, making it one of the largest tech acquisitions in history.',
    },
];

const FIELD_CONFIG = {
    people:        { label: 'People',        bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
    organizations: { label: 'Organizations', bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
    locations:     { label: 'Locations',     bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700' },
    dates:         { label: 'Dates',         bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
    topics:        { label: 'Topics',        bg: 'bg-rose-50',   border: 'border-rose-200',   badge: 'bg-rose-100 text-rose-700' },
};

const FieldCard = ({ field, values }) => {
    const cfg = FIELD_CONFIG[field] ?? { label: field, bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700' };
    return (
        <div className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-2">{cfg.label}</p>
            {values && values.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {values.map((v, i) => (
                        <span key={i} className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>{v}</span>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-gray-400 italic">None detected</p>
            )}
        </div>
    );
};

const StructuredOutput = () => {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const extract = async (text) => {
        const msg = text ?? input;
        if (!msg.trim()) return;
        setLoading(true);
        setResult(null);
        setError(null);

        try {
            const res = await axios.get(
                `${API_BASE}/structured/extract?message=${encodeURIComponent(msg)}`
            );
            setResult(res.data);
            if (text !== undefined) setInput(msg);
        } catch (err) {
            const detail = err.response?.data?.userMessage
                ?? 'Could not reach the server. Make sure the backend is running.';
            setError(detail);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            extract();
        }
    };

    return (
        <div className="flex h-full bg-gray-100 overflow-hidden">

            {/* Left — Example prompts */}
            <div className="w-72 min-w-[18rem] bg-white border-r border-gray-200 p-6 flex flex-col shadow-sm overflow-y-auto">
                <h2 className="text-base font-bold text-indigo-600 mb-1 tracking-wide uppercase">Examples</h2>
                <p className="text-xs text-gray-400 mb-5">Click to pre-fill and run instantly</p>

                <div className="space-y-3">
                    {EXAMPLES.map((ex) => (
                        <div key={ex.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <p className="text-xs font-semibold text-gray-700 mb-1">{ex.label}</p>
                            <button
                                onClick={() => extract(ex.prompt)}
                                disabled={loading}
                                className="w-full text-left text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1.5 rounded border border-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors leading-relaxed"
                            >
                                "{ex.prompt.slice(0, 80)}{ex.prompt.length > 80 ? '…' : ''}"
                            </button>
                        </div>
                    ))}
                </div>

                <div className="mt-auto pt-5 border-t border-gray-100">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                        <p className="text-xs font-semibold text-amber-700 mb-1">JSON Schema Enforcement</p>
                        <p className="text-xs text-amber-600 leading-relaxed">
                            Spring AI forces the LLM to return a structured JSON matching the <code className="bg-amber-100 rounded px-0.5">EntityExtractionResult</code> schema.
                            Best results with Anthropic profile.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right — Input + Result */}
            <div className="flex flex-col flex-1 p-6 min-w-0 overflow-y-auto">

                <div className="mb-4 px-4 py-3 bg-white rounded-xl shadow-sm border-l-4 border-indigo-400 flex-shrink-0">
                    <p className="text-sm font-semibold text-indigo-600 mb-0.5">Structured Output</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Force the LLM to return a typed JSON schema — Spring AI's <code>BeanOutputConverter</code> extracts
                        named entities (people, organizations, locations, dates, topics) from any free text.
                    </p>
                </div>

                {/* Input area */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex-shrink-0">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Paste any text here — news articles, bios, event descriptions…"
                        rows={4}
                        disabled={loading}
                        className="w-full p-2.5 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:border-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-end mt-2">
                        <button
                            onClick={() => extract()}
                            disabled={loading || !input.trim()}
                            className="bg-indigo-500 text-white border-none rounded p-2.5 px-4 cursor-pointer text-sm flex items-center gap-2 hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                            <IoMdSend size={16} />
                            Extract Entities
                        </button>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="bg-white rounded-xl shadow-sm p-5 mb-4 flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        <span className="text-xs text-gray-400 ml-1">Extracting entities…</span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex-shrink-0">
                        <p className="text-sm font-semibold text-red-600 mb-0.5">Extraction failed</p>
                        <p className="text-xs text-red-500 leading-relaxed">{error}</p>
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div className="bg-white rounded-xl shadow-sm p-5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Extracted Entities</p>
                        <div className="grid grid-cols-1 gap-3 mb-4">
                            {Object.entries(result).map(([field, values]) => (
                                <FieldCard key={field} field={field} values={values} />
                            ))}
                        </div>
                        <details className="mt-2">
                            <summary className="text-xs text-gray-400 cursor-pointer hover:text-indigo-500 select-none">
                                Show raw JSON
                            </summary>
                            <pre className="mt-2 bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto leading-relaxed">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StructuredOutput;
