import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * Renders an assistant message as markdown (GFM: tables, lists, code, links).
 * Scoped to AI bubbles only — user messages stay literal in the callers.
 */
const MarkdownMessage = ({ text }) => (
    <div className="prose prose-sm max-w-none break-words">
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({ inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (!inline && match) {
                        return (
                            <SyntaxHighlighter
                                style={oneLight}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{ borderRadius: '0.5rem', margin: '0.5rem 0' }}
                                {...props}
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        );
                    }
                    return (
                        <code className="bg-gray-300/60 rounded px-1 py-0.5 text-sm font-mono" {...props}>
                            {children}
                        </code>
                    );
                },
                table({ children }) {
                    return (
                        <div className="overflow-x-auto">
                            <table className="border-collapse border border-gray-300">{children}</table>
                        </div>
                    );
                },
                th({ children }) {
                    return <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-left">{children}</th>;
                },
                td({ children }) {
                    return <td className="border border-gray-300 px-2 py-1">{children}</td>;
                },
                a({ children, ...props }) {
                    return (
                        <a target="_blank" rel="noreferrer" {...props}>
                            {children}
                        </a>
                    );
                },
            }}
        >
            {text}
        </ReactMarkdown>
    </div>
);

export default MarkdownMessage;
