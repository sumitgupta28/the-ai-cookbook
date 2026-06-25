import { useState } from 'react';
import RAGChatbot from './RAGChatbot';
import RAGChatbotWithMemory from './RAGChatbotWithMemory';
import ChatBot from './ChatBot';
import VectorSearch from './VectorSearch';
import DocumentUpload from './DocumentUpload';
import ToolAgent from './ToolAgent';
import StructuredOutput from './StructuredOutput';
import ProductSearch from './ProductSearch';
import ChunkingLab from './ChunkingLab';

function App() {
    const [tab, setTab] = useState('chat');

    const tabClass = (name) =>
        `px-6 py-2 text-sm cursor-pointer border-b-2 rounded-t transition-colors bg-transparent ${
            tab === name
                ? 'text-indigo-500 border-indigo-500 font-semibold'
                : 'text-gray-500 border-transparent hover:text-indigo-400'
        }`;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <nav className="flex items-center gap-1 px-4 pt-3 bg-white border-b border-gray-200 flex-shrink-0">
                <img src="/ai-chatbot-logo.png" alt="Chatbot Logo" className="h-10 mr-3" />
                <div className="flex items-center gap-1">
                    <button className={tabClass('chat')} onClick={() => setTab('chat')}>
                        💬 Chat
                    </button>
                    <button className={tabClass('docs')} onClick={() => setTab('docs')}>
                        📄 Documents
                    </button>
                    <button className={tabClass('vector')} onClick={() => setTab('vector')}>
                        🗄️ Vector Search
                    </button>
                    <button className={tabClass('rag')} onClick={() => setTab('rag')}>
                        🔍 RAG Chat
                    </button>
                    <button className={tabClass('rag-memory')} onClick={() => setTab('rag-memory')}>
                        🧠 RAG + Memory
                    </button>
                    <button className={tabClass('tools')} onClick={() => setTab('tools')}>
                        🔧 Tool Agent
                    </button>
                    <button className={tabClass('structured')} onClick={() => setTab('structured')}>
                        📊 Structured
                    </button>
                    <button className={tabClass('products')} onClick={() => setTab('products')}>
                        🛍️ Product Search
                    </button>
                    <button className={tabClass('chunking')} onClick={() => setTab('chunking')}>
                        🧪 Chunking Lab
                    </button>
                </div>
            </nav>
            <div className="flex-1 overflow-hidden">
                {tab === 'chat' && <ChatBot />}
                {tab === 'vector' && <VectorSearch />}
                {tab === 'rag' && <RAGChatbot />}
                {tab === 'rag-memory' && <RAGChatbotWithMemory />}
                {tab === 'docs' && <DocumentUpload />}
                {tab === 'tools' && <ToolAgent />}
                {tab === 'structured' && <StructuredOutput />}
                {tab === 'products' && <ProductSearch />}
                {tab === 'chunking' && <ChunkingLab />}
            </div>
        </div>
    );
}

export default App;
