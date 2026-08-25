import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';
const ACCEPTED_TYPES = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
];

const DocumentUpload = () => {
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [notice, setNotice] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => { fetchDocuments(); }, []);

    const fetchDocuments = async () => {
        try {
            const res = await axios.get(`${API_BASE}/documents`);
            setDocuments(res.data);
        } catch {
            setNotice({ type: 'error', text: 'Could not load document list.' });
        }
    };

    const upload = async (file) => {
        if (!file) return;
        if (!ACCEPTED_TYPES.includes(file.type)) {
            setNotice({ type: 'error', text: 'Unsupported file type. Please upload PDF, TXT, or DOCX.' });
            return;
        }
        setUploading(true);
        setNotice(null);
        const form = new FormData();
        form.append('file', file);
        try {
            await axios.post(`${API_BASE}/documents/upload`, form);
            setNotice({ type: 'success', text: `"${file.name}" uploaded and indexed.` });
            fetchDocuments();
        } catch {
            setNotice({ type: 'error', text: `Upload failed for "${file.name}". Check the server logs.` });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (id, filename) => {
        if (!window.confirm(`Delete "${filename}" and all its indexed content?`)) return;
        try {
            await axios.delete(`${API_BASE}/documents/${id}`);
            fetchDocuments();
        } catch {
            setNotice({ type: 'error', text: `Delete failed for "${filename}".` });
        }
    };

    const fmtSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    const fmtDate = (dt) => new Date(dt).toLocaleString();

    const dropZoneClass = `border-2 border-dashed rounded-xl py-11 px-6 text-center select-none mb-3 transition-colors ${
        uploading
            ? 'cursor-not-allowed opacity-70 border-indigo-300 bg-gray-50'
            : dragOver
            ? 'border-indigo-500 bg-indigo-50 cursor-pointer'
            : 'border-indigo-300 bg-gray-50 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50'
    }`;

    return (
        <div className="max-w-3xl mx-auto px-4 py-7 text-left h-full overflow-y-auto">
            <div>
                <h2 className="text-base font-semibold text-gray-700 mb-3">Upload Document</h2>
                <div
                    className={dropZoneClass}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files[0]); }}
                    onClick={() => !uploading && fileInputRef.current.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.docx,.doc"
                        className="hidden"
                        onChange={(e) => upload(e.target.files[0])}
                    />
                    {uploading ? (
                        <div className="flex flex-col items-center gap-3 text-gray-500 text-sm">
                            <div className="w-7 h-7 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
                            <span>Uploading and indexing…</span>
                        </div>
                    ) : (
                        <>
                            <div className="text-4xl mb-2.5">📄</div>
                            <p className="my-1 text-gray-600 text-sm">
                                Drag &amp; drop or <span className="text-indigo-500 font-medium">click to browse</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1.5">PDF · TXT · DOCX — max 50 MB</p>
                        </>
                    )}
                </div>
                {notice && (
                    <div className={`px-3.5 py-2.5 rounded-lg text-sm mt-1.5 border ${
                        notice.type === 'success'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                    }`}>
                        {notice.text}
                    </div>
                )}
            </div>

            <div className="mt-9">
                <h2 className="text-base font-semibold text-gray-700 mb-3">Indexed Documents</h2>
                {documents.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-9 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        No documents indexed yet. Upload one above to enable RAG.
                    </p>
                ) : (
                    <div className="overflow-hidden rounded-xl shadow-sm border border-gray-100">
                        <table className="w-full border-collapse text-sm bg-white">
                            <thead>
                                <tr>
                                    {['Filename', 'Type', 'Size', 'Chunks', 'Uploaded', ''].map((h, i) => (
                                        <th key={i} className="bg-gray-50 text-gray-500 font-semibold text-left px-3.5 py-2.5 border-b-2 border-gray-100">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map((doc) => (
                                    <tr key={doc.id} className="border-b border-gray-50 last:border-b-0 hover:bg-indigo-50/40">
                                        <td className="px-3.5 py-2.5 text-gray-700 font-medium break-all">{doc.filename}</td>
                                        <td className="px-3.5 py-2.5 text-gray-400 text-xs">{doc.contentType}</td>
                                        <td className="px-3.5 py-2.5 text-gray-700">{fmtSize(doc.fileSize)}</td>
                                        <td className="px-3.5 py-2.5 text-gray-700 text-center">{doc.chunkCount}</td>
                                        <td className="px-3.5 py-2.5 text-gray-700">{fmtDate(doc.uploadTime)}</td>
                                        <td className="px-3.5 py-2.5">
                                            <button
                                                className="border border-red-400 text-red-500 bg-transparent px-2.5 py-1 rounded-md text-xs cursor-pointer whitespace-nowrap hover:bg-red-50 transition-colors"
                                                onClick={() => handleDelete(doc.id, doc.filename)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentUpload;
