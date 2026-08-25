import React, { useState } from 'react';
import axios from 'axios';
import { IoMdSearch } from 'react-icons/io';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

const StatusBadge = ({ status }) => (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
    }`}>
        {status === 'ok' ? '✅' : '❌'} {status}
    </span>
);

const SimilarityBar = ({ value }) => {
    const pct = Math.round(value * 100);
    const color = pct >= 70 ? '#48bb78' : pct >= 40 ? '#d69e2e' : '#e53e3e';
    return (
        <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
        </div>
    );
};

const VectorSearch = () => {
    const [health, setHealth] = useState(null);
    const [healthLoading, setHealthLoading] = useState(false);

    const [query, setQuery] = useState('');
    const [topK, setTopK] = useState(10);
    const [threshold, setThreshold] = useState(0.0);
    const [searchResult, setSearchResult] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);

    const checkHealth = async () => {
        setHealthLoading(true);
        setHealth(null);
        try {
            const res = await axios.get(`${API_BASE}/documents/verify`);
            setHealth(res.data);
        } catch {
            setHealth({ status: 'error', documentsCount: 0, documents: [] });
        } finally {
            setHealthLoading(false);
        }
    };

    const runSearch = async () => {
        if (!query.trim()) return;
        setSearchLoading(true);
        setSearchResult(null);
        try {
            const res = await axios.get(
                `${API_BASE}/documents/verify/search?query=${encodeURIComponent(query)}&topK=${topK}&similarityThreshold=${threshold}`
            );
            setSearchResult(res.data);
        } catch {
            setSearchResult({ error: true });
        } finally {
            setSearchLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') runSearch();
    };

    const fmtSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    return (
        <div className="h-full overflow-y-auto bg-gray-100 p-6">
            <div className="max-w-4xl mx-auto space-y-5">

                {/* Page header */}
                <div className="px-4 py-3 bg-white rounded-xl shadow-sm border-l-4 border-indigo-400">
                    <p className="text-sm font-semibold text-indigo-600 mb-0.5">Vector Search</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Inspect what's stored in your vector database and test similarity search before chatting.
                        Use this to verify documents are indexed correctly and to calibrate your RAG settings.
                    </p>
                </div>

                {/* Card 1 — Vector Store Health */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-bold text-gray-700">Vector Store Health</h2>
                            <p className="text-xs text-gray-400 mt-0.5">Check all indexed chunks currently in the vector store</p>
                        </div>
                        <button
                            onClick={checkHealth}
                            disabled={healthLoading}
                            className="bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                            {healthLoading ? 'Checking…' : 'Check Store'}
                        </button>
                    </div>

                    {health && (
                        <>
                            <div className="flex items-center gap-6 mb-4 px-4 py-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Status</span>
                                    <StatusBadge status={health.status} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Chunks indexed</span>
                                    <span className="text-sm font-bold text-indigo-600">{health.documentsCount}</span>
                                </div>
                            </div>

                            {health.documents?.length > 0 ? (
                                <div className="overflow-hidden rounded-lg border border-gray-100">
                                    <table className="w-full text-sm border-collapse bg-white">
                                        <thead>
                                            <tr>
                                                {['Filename', 'Chunk Size', 'Content Preview'].map((h, i) => (
                                                    <th key={i} className="text-left px-3.5 py-2.5 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {health.documents.map((doc, i) => (
                                                <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-indigo-50/30">
                                                    <td className="px-3.5 py-2.5 font-medium text-gray-700 whitespace-nowrap">{doc.filename}</td>
                                                    <td className="px-3.5 py-2.5 text-gray-500 whitespace-nowrap">{fmtSize(doc.contentLength)}</td>
                                                    <td className="px-3.5 py-2.5 text-gray-400 text-xs max-w-xs truncate">{doc.contentPreview}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    No chunks found in the vector store. Upload a document first.
                                </p>
                            )}
                        </>
                    )}

                    {!health && !healthLoading && (
                        <p className="text-xs text-gray-400 text-center py-6">Click <strong>Check Store</strong> to inspect the vector database.</p>
                    )}
                </div>

                {/* Card 2 — Similarity Search Tester */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    <div className="mb-4">
                        <h2 className="text-sm font-bold text-gray-700">Similarity Search Tester</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Run a raw similarity search to see which chunks match a query and how closely</p>
                    </div>

                    {/* Controls */}
                    <div className="flex gap-3 mb-3">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a search query…"
                            className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                        />
                        <button
                            onClick={runSearch}
                            disabled={searchLoading || !query.trim()}
                            aria-label="Search"
                            className="bg-indigo-500 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 text-sm font-medium"
                        >
                            <IoMdSearch size={16} />
                            {searchLoading ? 'Searching…' : 'Search'}
                        </button>
                    </div>

                    <div className="flex gap-4 mb-4">
                        <label className="flex items-center gap-2 text-xs text-gray-500">
                            Top K
                            <input
                                type="number"
                                min={1} max={50} value={topK}
                                onChange={(e) => setTopK(Number(e.target.value))}
                                className="w-16 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-indigo-400"
                            />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-500">
                            Similarity Threshold
                            <input
                                type="number"
                                min={0} max={1} step={0.05} value={threshold}
                                onChange={(e) => setThreshold(Number(e.target.value))}
                                className="w-16 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-indigo-400"
                            />
                        </label>
                    </div>

                    {searchResult && !searchResult.error && (
                        <>
                            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-gray-50 rounded-lg">
                                <span className="text-xs text-gray-500">Query:</span>
                                <span className="text-xs font-semibold text-gray-700">"{searchResult.query}"</span>
                                <span className="ml-auto text-xs text-gray-500">Chunks matched:</span>
                                <span className={`text-sm font-bold ${searchResult.hitsFound > 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                                    {searchResult.hitsFound}
                                </span>
                            </div>

                            {searchResult.results?.length > 0 ? (
                                <div className="overflow-hidden rounded-lg border border-gray-100">
                                    <table className="w-full text-sm border-collapse bg-white">
                                        <thead>
                                            <tr>
                                                {['#', 'Filename', 'Similarity', 'Content Preview'].map((h, i) => (
                                                    <th key={i} className="text-left px-3.5 py-2.5 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {searchResult.results.map((r, i) => (
                                                <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-indigo-50/30">
                                                    <td className="px-3.5 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                                                    <td className="px-3.5 py-2.5 font-medium text-gray-700 whitespace-nowrap">{r.filename}</td>
                                                    <td className="px-3.5 py-2.5"><SimilarityBar value={r.similarity} /></td>
                                                    <td className="px-3.5 py-2.5 text-gray-400 text-xs max-w-xs">
                                                        <span className="line-clamp-2">{r.contentPreview}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    No chunks matched. Try lowering the Similarity Threshold or upload more documents.
                                </p>
                            )}
                        </>
                    )}

                    {searchResult?.error && (
                        <p className="text-sm text-red-500 text-center py-4">Search failed. Check the server logs.</p>
                    )}

                    {!searchResult && !searchLoading && (
                        <p className="text-xs text-gray-400 text-center py-6">
                            💡 Use this to verify a topic is indexed and to calibrate the Similarity Threshold in RAG Chat.
                        </p>
                    )}
                </div>

            </div>
        </div>
    );
};

export default VectorSearch;
