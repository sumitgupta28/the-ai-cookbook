import { useState, useRef } from 'react';
import axios from 'axios';

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

function StarRating({ rating }) {
    if (!rating) return null;
    const stars = Math.round(Number(rating));
    return (
        <div className="flex items-center gap-0.5 text-yellow-400 text-sm">
            {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={i <= stars ? 'text-yellow-400' : 'text-gray-200'}>★</span>
            ))}
            <span className="ml-1 text-gray-500 text-xs">{Number(rating).toFixed(1)}</span>
        </div>
    );
}

function ProductCard({ product }) {
    const [imgError, setImgError] = useState(false);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="relative h-48 bg-gray-50 flex items-center justify-center overflow-hidden">
                {!imgError ? (
                    <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-gray-300 h-full w-full bg-gray-50">
                        <span className="text-5xl">📦</span>
                        <span className="text-xs mt-1">No image</span>
                    </div>
                )}
                {product.category && (
                    <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                        {product.category}
                    </span>
                )}
            </div>
            <div className="p-4 flex flex-col gap-1 flex-1">
                <h3 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2">{product.name}</h3>
                {product.brand && (
                    <p className="text-xs text-gray-400">{product.brand}</p>
                )}
                <StarRating rating={product.rating} />
                <p className="text-lg font-bold text-indigo-600 mt-1">${Number(product.price).toFixed(2)}</p>
                {product.description && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mt-1">{product.description}</p>
                )}
                {product.stockCount != null && (
                    <p className={`text-xs mt-auto pt-2 font-medium ${product.stockCount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {product.stockCount > 0 ? `${product.stockCount} in stock` : 'Out of stock'}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function ProductSearch() {
    const [dragOver, setDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [uploadNotice, setUploadNotice] = useState(null);
    const fileInputRef = useRef();

    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState(null);
    const [searchNotice, setSearchNotice] = useState(null);

    const [similarityThreshold, setSimilarityThreshold] = useState(0.0);
    const [topK, setTopK] = useState(12);

    const [healthOpen, setHealthOpen] = useState(false);
    const [health, setHealth] = useState(null);
    const [healthLoading, setHealthLoading] = useState(false);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) uploadFile(file);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) uploadFile(file);
        e.target.value = '';
    };

    const uploadFile = async (file) => {
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            setUploadNotice({ type: 'error', text: 'Only .xlsx or .xls files are supported.' });
            return;
        }
        setUploading(true);
        setUploadResult(null);
        setUploadNotice(null);
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await axios.post(`${API_BASE}/products/upload`, form);
            setUploadResult(res.data);
            setUploadNotice({
                type: 'success',
                text: `Successfully imported ${res.data.imported} product${res.data.imported !== 1 ? 's' : ''}${res.data.skipped > 0 ? `, skipped ${res.data.skipped}` : ''}.`
            });
        } catch (err) {
            const msg = err.response?.data || err.message || 'Upload failed.';
            setUploadNotice({ type: 'error', text: typeof msg === 'string' ? msg : 'Upload failed.' });
        } finally {
            setUploading(false);
        }
    };

    const handleSearch = async () => {
        if (!query.trim()) return;
        setSearching(true);
        setResults(null);
        setSearchNotice(null);
        try {
            const res = await axios.get(`${API_BASE}/products/search`, {
                params: { query: query.trim(), topK, threshold: similarityThreshold }
            });
            setResults(res.data);
            if (res.data.length === 0) {
                setSearchNotice({ type: 'info', text: 'No matching products found. Try lowering the similarity threshold or rephrasing.' });
            }
        } catch (err) {
            setSearchNotice({ type: 'error', text: 'Search failed. Make sure the backend is running.' });
        } finally {
            setSearching(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSearch();
    };

    const checkHealth = async () => {
        setHealthLoading(true);
        setHealth(null);
        try {
            const res = await axios.get(`${API_BASE}/products/verify`);
            setHealth(res.data);
        } catch {
            setHealth({ status: 'error', productCount: 0, products: [] });
        } finally {
            setHealthLoading(false);
        }
    };

    return (
        <div className="flex h-full bg-gray-100 overflow-hidden">

            {/* Left — Configuration panel */}
            <div className="w-72 min-w-[18rem] bg-white border-r border-gray-200 p-6 flex flex-col shadow-sm overflow-y-auto">
                <h2 className="text-base font-bold text-indigo-600 mb-1 tracking-wide uppercase">Product Search</h2>
                <p className="text-xs text-gray-400 mb-5">Tune vector retrieval parameters</p>

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
                        disabled={searching}
                    />

                    <GradientSlider
                        label="Top K"
                        value={topK}
                        min={1}
                        max={20}
                        step={1}
                        onChange={setTopK}
                        disabled={searching}
                    />
                </div>

                <div className="mt-auto pt-5 border-t border-gray-100">
                    <p className="text-xs text-gray-400 leading-relaxed space-y-1">
                        <span className="block"><strong className="text-gray-500">Threshold:</strong> min similarity score for a product to appear (0 = show all matches)</span>
                        <span className="block"><strong className="text-gray-500">Top K:</strong> max number of products returned per search</span>
                    </p>
                </div>
            </div>

            {/* Right — Main content */}
            <div className="flex-1 overflow-y-auto p-6 min-w-0">
                <div className="max-w-4xl mx-auto space-y-6">

                    {/* Vector Store Health — collapsible */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4">
                            <div>
                                <h2 className="text-sm font-bold text-gray-700">Vector Store Health</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Check all indexed products currently in the vector store</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={checkHealth}
                                    disabled={healthLoading}
                                    className="bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                >
                                    {healthLoading ? 'Checking…' : 'Check Store'}
                                </button>
                                <button
                                    onClick={() => setHealthOpen(o => !o)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                                    aria-label={healthOpen ? 'Collapse' : 'Expand'}
                                >
                                    <svg
                                        className={`w-4 h-4 transition-transform duration-200 ${healthOpen ? 'rotate-180' : ''}`}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {healthOpen && (
                            <div className="border-t border-gray-100 px-6 pb-5 pt-4">
                                {!health && !healthLoading && (
                                    <p className="text-xs text-gray-400 text-center py-6">
                                        Click <strong>Check Store</strong> to inspect the product vector database.
                                    </p>
                                )}

                                {healthLoading && (
                                    <div className="flex justify-center py-6">
                                        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}

                                {health && (
                                    <>
                                        <div className="flex items-center gap-6 mb-4 px-4 py-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">Status</span>
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                    health.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                                }`}>
                                                    {health.status === 'ok' ? '✅' : '❌'} {health.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">Products indexed</span>
                                                <span className="text-sm font-bold text-indigo-600">{health.productCount}</span>
                                            </div>
                                        </div>

                                        {health.products?.length > 0 ? (
                                            <div className="overflow-hidden rounded-lg border border-gray-100">
                                                <table className="w-full text-sm border-collapse bg-white">
                                                    <thead>
                                                        <tr>
                                                            {['Product ID', 'Name', 'Embedding Preview'].map((h, i) => (
                                                                <th key={i} className="text-left px-3.5 py-2.5 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                                                                    {h}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {health.products.map((p, i) => (
                                                            <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-indigo-50/30">
                                                                <td className="px-3.5 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{p.productId}</td>
                                                                <td className="px-3.5 py-2.5 font-medium text-gray-700 whitespace-nowrap">{p.name}</td>
                                                                <td className="px-3.5 py-2.5 text-gray-400 text-xs max-w-xs truncate">{p.contentPreview}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                No products found in the vector store. Upload an XLS file first.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Upload Section */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-base font-semibold text-gray-700 mb-1">📦 Upload Product Catalog</h2>
                        <p className="text-xs text-gray-400 mb-4">
                            Upload an <strong>.xlsx</strong> file with columns: <code>ProductID, Name, Category, Brand, Description, Price, ImageUrl, Rating, StockCount</code>.
                            Each product is embedded into the vector store for semantic search.
                        </p>

                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                                dragOver
                                    ? 'border-indigo-400 bg-indigo-50'
                                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                            } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            {uploading ? (
                                <div className="flex flex-col items-center gap-2 text-indigo-500">
                                    <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm">Uploading and indexing products…</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-gray-400">
                                    <span className="text-4xl">📊</span>
                                    <p className="text-sm font-medium text-gray-600">Drag &amp; drop your .xlsx file here</p>
                                    <p className="text-xs">or click to browse</p>
                                </div>
                            )}
                        </div>

                        {uploadNotice && (
                            <div className={`mt-3 text-sm px-4 py-2 rounded-lg ${
                                uploadNotice.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
                            }`}>
                                {uploadNotice.text}
                            </div>
                        )}

                        {uploadResult && uploadResult.errors?.length > 0 && (
                            <details className="mt-2">
                                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                                    {uploadResult.errors.length} row(s) had errors — click to expand
                                </summary>
                                <ul className="mt-1 text-xs text-red-500 space-y-0.5 pl-3">
                                    {uploadResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                            </details>
                        )}
                    </div>

                    {/* Search Section */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-base font-semibold text-gray-700 mb-1">🔍 Semantic Product Search</h2>
                        <p className="text-xs text-gray-400 mb-4">
                            Describe what you're looking for in natural language — the search uses vector embeddings to find the most relevant products.
                        </p>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="e.g. wireless noise-cancelling headphones for travel"
                                className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                                disabled={searching}
                            />
                            <button
                                onClick={handleSearch}
                                disabled={searching || !query.trim()}
                                className="px-5 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {searching ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Searching…
                                    </>
                                ) : 'Search'}
                            </button>
                        </div>

                        {searchNotice && (
                            <div className={`mt-3 text-sm px-4 py-2 rounded-lg ${
                                searchNotice.type === 'error'
                                    ? 'bg-red-50 text-red-600 border border-red-200'
                                    : 'bg-blue-50 text-blue-600 border border-blue-200'
                            }`}>
                                {searchNotice.text}
                            </div>
                        )}

                        {results && results.length > 0 && (
                            <div className="mt-5">
                                <p className="text-xs text-gray-400 mb-3">
                                    {results.length} result{results.length !== 1 ? 's' : ''} found
                                    <span className="ml-2 text-gray-300">·</span>
                                    <span className="ml-2">Top K: {topK}</span>
                                    <span className="ml-2 text-gray-300">·</span>
                                    <span className="ml-2">Threshold: {similarityThreshold.toFixed(2)}</span>
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {results.map((p) => (
                                        <ProductCard key={p.productId} product={p} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
