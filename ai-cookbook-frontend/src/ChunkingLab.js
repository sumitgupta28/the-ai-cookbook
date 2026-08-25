import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

const ACCEPTED_TYPES = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
];

const STRATEGIES = {
    RECURSIVE:    { label: 'Recursive (LangChain4j)',    unit: 'chars',  desc: 'Hierarchical: paragraph → sentence → word → character. Best general-purpose strategy.' },
    BY_PARAGRAPH: { label: 'By Paragraph (LangChain4j)', unit: 'chars',  desc: 'Splits on double newlines (\\n\\n). Good for well-structured documents.' },
    BY_SENTENCE:  { label: 'By Sentence (LangChain4j)',  unit: 'chars',  desc: 'Splits at sentence boundaries. Good for narrative or prose text.' },
    BY_WORD:      { label: 'By Word (LangChain4j)',       unit: 'chars',  desc: 'Splits at word boundaries. Guarantees no mid-word cuts.' },
    TOKEN_TEXT:   { label: 'Token Text (Spring AI)',      unit: 'tokens', desc: 'Token-count based splitting — same algorithm used by the RAG pipeline. No overlap parameter.' },
};

const ChunkingLab = () => {
    const [file, setFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [strategy, setStrategy] = useState('RECURSIVE');
    const [chunkSize, setChunkSize] = useState(1000);
    const [overlap, setOverlap] = useState(100);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [expandedChunks, setExpandedChunks] = useState(new Set());
    const fileInputRef = useRef(null);

    const isTokenStrategy = strategy === 'TOKEN_TEXT';
    const unit = STRATEGIES[strategy]?.unit || 'chars';
    const chunkSizeMin = isTokenStrategy ? 64 : 100;
    const chunkSizeMax = isTokenStrategy ? 2048 : 5000;

    useEffect(() => {
        if (isTokenStrategy) {
            setChunkSize(512);
            setOverlap(0);
        } else {
            setChunkSize(1000);
            setOverlap(100);
        }
        setResult(null);
    }, [strategy]);

    const handleFile = (f) => {
        if (!f) return;
        if (!ACCEPTED_TYPES.includes(f.type)) {
            setError('Unsupported file type. Please upload PDF, TXT, or DOCX.');
            return;
        }
        setFile(f);
        setResult(null);
        setError(null);
        setExpandedChunks(new Set());
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        const form = new FormData();
        form.append('file', file);
        form.append('strategy', strategy);
        form.append('chunkSize', chunkSize);
        form.append('overlap', isTokenStrategy ? 0 : overlap);
        try {
            const res = await axios.post(`${API_BASE}/chunking/analyze`, form);
            setResult(res.data);
            setExpandedChunks(new Set());
        } catch (e) {
            setError(e.response?.data || e.message || 'Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    const toggleChunk = (idx) => {
        setExpandedChunks(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx); else next.add(idx);
            return next;
        });
    };

    const expandAll = () => setExpandedChunks(new Set(result?.chunks?.map(c => c.index) || []));
    const collapseAll = () => setExpandedChunks(new Set());
    const allExpanded = result && result.chunks.length > 0 && expandedChunks.size === result.chunks.length;

    const dropZoneClass = `border-2 border-dashed rounded-xl py-8 px-6 text-center select-none mb-4 transition-colors ${
        dragOver
            ? 'border-indigo-500 bg-indigo-50 cursor-pointer'
            : 'border-indigo-300 bg-gray-50 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50'
    }`;

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 text-left h-full overflow-y-auto">
            {/* Header */}
            <div className="mb-5">
                <h2 className="text-base font-semibold text-gray-800">🧪 Chunking Lab</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                    Analyze how different strategies split your document — nothing is stored or indexed.
                </p>
            </div>

            {/* Drop zone */}
            <div
                className={dropZoneClass}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.docx,.doc"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files[0])}
                />
                {file ? (
                    <div className="text-sm text-gray-700">
                        <div className="text-2xl mb-1">📎</div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB — click to replace</p>
                    </div>
                ) : (
                    <>
                        <div className="text-3xl mb-2">📂</div>
                        <p className="text-sm text-gray-600">
                            Drop a file here or <span className="text-indigo-500 font-medium">click to browse</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">PDF · TXT · DOCX</p>
                    </>
                )}
            </div>

            {/* Strategy + Parameters card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
                {/* Strategy selector */}
                <div className="mb-5">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Chunking Strategy
                    </label>
                    <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                        value={strategy}
                        onChange={(e) => setStrategy(e.target.value)}
                    >
                        {Object.entries(STRATEGIES).map(([key, { label }]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1.5">{STRATEGIES[strategy]?.desc}</p>
                </div>

                {/* Parameters */}
                <div className={`grid gap-6 ${isTokenStrategy ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {/* Chunk Size */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Chunk Size{' '}
                            <span className="text-indigo-400 normal-case font-normal">({unit})</span>
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={chunkSizeMin}
                                max={chunkSizeMax}
                                step={isTokenStrategy ? 32 : 50}
                                value={chunkSize}
                                onChange={(e) => setChunkSize(Number(e.target.value))}
                                className="flex-1 accent-indigo-500"
                            />
                            <input
                                type="number"
                                min={chunkSizeMin}
                                max={chunkSizeMax}
                                value={chunkSize}
                                onChange={(e) => setChunkSize(Math.max(chunkSizeMin, Math.min(chunkSizeMax, Number(e.target.value))))}
                                className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-0.5 px-0.5">
                            <span>{chunkSizeMin}</span>
                            <span>{chunkSizeMax}</span>
                        </div>
                    </div>

                    {/* Overlap (hidden for TOKEN_TEXT) */}
                    {!isTokenStrategy && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                Overlap{' '}
                                <span className="text-indigo-400 normal-case font-normal">(chars)</span>
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min={0}
                                    max={Math.max(0, chunkSize - 1)}
                                    step={10}
                                    value={overlap}
                                    onChange={(e) => setOverlap(Number(e.target.value))}
                                    className="flex-1 accent-indigo-500"
                                />
                                <input
                                    type="number"
                                    min={0}
                                    max={Math.max(0, chunkSize - 1)}
                                    value={overlap}
                                    onChange={(e) =>
                                        setOverlap(Math.max(0, Math.min(chunkSize - 1, Number(e.target.value))))
                                    }
                                    className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-0.5 px-0.5">
                                <span>0</span>
                                <span>{chunkSize - 1}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Analyze button */}
            <button
                onClick={handleAnalyze}
                disabled={!file || loading}
                className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors mb-3 ${
                    !file || loading
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                }`}
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                        Analyzing…
                    </span>
                ) : (
                    'Analyze Chunks'
                )}
            </button>

            {/* Error banner */}
            {error && (
                <div className="mb-3 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex justify-between items-start">
                    <span>{typeof error === 'object' ? JSON.stringify(error) : error}</span>
                    <button
                        onClick={() => setError(null)}
                        className="ml-3 text-red-400 hover:text-red-600 cursor-pointer text-base leading-none"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="mt-2">
                    {/* Summary header */}
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">Analysis Results</h3>
                        <span className="text-xs text-gray-400">
                            {result.strategy} · chunk size: {result.chunkSize} {unit}
                            {!isTokenStrategy && ` · overlap: ${result.overlap} chars`}
                        </span>
                    </div>

                    {/* Stat tiles */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                        {[
                            { label: 'Total Chunks',       value: result.totalChunks.toLocaleString() },
                            { label: '~Total Tokens',      value: result.totalEstimatedTokens.toLocaleString() },
                            { label: 'Total Chars',        value: result.totalChars.toLocaleString() },
                            { label: 'Avg Chars / Chunk',  value: result.avgCharsPerChunk.toFixed(1) },
                            { label: '~Avg Tokens / Chunk',value: result.avgEstimatedTokensPerChunk.toFixed(1) },
                            { label: 'Min / Max Chars',    value: `${result.minChunkChars} / ${result.maxChunkChars}` },
                        ].map(({ label, value }) => (
                            <div key={label} className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                                <div className="text-lg font-bold text-indigo-700">{value}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Chunk list header */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {result.chunks.length} Chunks
                        </span>
                        <button
                            onClick={allExpanded ? collapseAll : expandAll}
                            className="text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer"
                        >
                            {allExpanded ? 'Collapse All' : 'Expand All'}
                        </button>
                    </div>

                    {/* Chunk list */}
                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                        {result.chunks.map((chunk) => {
                            const expanded = expandedChunks.has(chunk.index);
                            const widthPct = result.maxChunkChars > 0
                                ? Math.max(4, (chunk.charCount / result.maxChunkChars) * 100)
                                : 100;
                            return (
                                <div key={chunk.index} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                    <div
                                        className="px-4 py-2.5 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                                        onClick={() => toggleChunk(chunk.index)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-xs font-mono text-gray-400 shrink-0 w-8">
                                                #{chunk.index}
                                            </span>
                                            <div className="w-20 bg-gray-100 rounded-full h-1.5 shrink-0">
                                                <div
                                                    className="bg-indigo-400 h-1.5 rounded-full"
                                                    style={{ width: `${widthPct}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-600 truncate">
                                                {chunk.charCount.toLocaleString()} chars · {chunk.wordCount} words · ~{chunk.estimatedTokens} tokens
                                            </span>
                                        </div>
                                        <span className="text-gray-400 text-xs shrink-0 ml-2">
                                            {expanded ? '▲' : '▼'}
                                        </span>
                                    </div>
                                    {expanded && (
                                        <pre className="px-4 py-3 text-xs font-mono text-gray-700 bg-gray-50 border-t border-gray-100 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                                            {chunk.contentPreview}
                                            {chunk.charCount > 300 && (
                                                <span className="text-gray-400">
                                                    {' '}…[{chunk.charCount - 300} more chars]
                                                </span>
                                            )}
                                        </pre>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChunkingLab;
