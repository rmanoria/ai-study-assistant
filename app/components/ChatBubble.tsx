"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

type Props = {
  role: "user" | "assistant";
  content: string;
  darkMode?: boolean;
};

export default function ChatBubble({ content, darkMode = true }: Props) {
  return (
    <div
      className={`
        prose max-w-none text-sm
        prose-headings:font-semibold prose-headings:leading-tight
        prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
        prose-p:leading-7 prose-p:mb-3 prose-p:mt-0
        prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0
        prose-img:rounded-xl
        prose-table:w-full
        prose-th:border prose-td:border prose-th:p-2 prose-td:p-2
        prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-3
        prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5
        prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5
        prose-li:my-1 prose-li:pl-1
        ${
          darkMode
            ? `
              prose-headings:text-white
              prose-p:text-gray-200
              prose-strong:text-violet-300 prose-strong:font-semibold
              prose-em:text-gray-300
              prose-li:text-gray-200
              prose-code:text-cyan-300
              prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
              prose-blockquote:text-gray-300 prose-blockquote:border-violet-500
              prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
              prose-th:bg-white/8 prose-th:text-white prose-td:text-gray-200
              prose-table:border prose-table:border-white/10
              prose-hr:border-white/10
            `
            : `
              prose-headings:text-gray-900
              prose-p:text-gray-700
              prose-strong:text-violet-700 prose-strong:font-semibold
              prose-em:text-gray-500
              prose-li:text-gray-700
              prose-code:text-violet-700
              prose-code:bg-violet-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
              prose-blockquote:text-gray-500 prose-blockquote:border-violet-300
              prose-a:text-violet-600 prose-a:no-underline hover:prose-a:underline
              prose-th:bg-gray-100 prose-th:text-gray-800 prose-td:text-gray-700
              prose-table:border prose-table:border-gray-200
              prose-hr:border-gray-200
            `
        }
      `}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ul({ children }) {
            return (
              <ul style={{ listStyleType: "disc", paddingLeft: "1.4rem", margin: "0.4rem 0" }}
                className={darkMode ? "text-gray-200" : "text-gray-700"}>
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol style={{ listStyleType: "decimal", paddingLeft: "1.4rem", margin: "0.4rem 0" }}
                className={darkMode ? "text-gray-200" : "text-gray-700"}>
                {children}
              </ol>
            );
          },
          li({ children }) {
            return (
              <li style={{ marginBottom: "0.25rem", paddingLeft: "0.25rem" }}
                className={darkMode ? "text-gray-200" : "text-gray-700"}>
                {children}
              </li>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className={`w-full border-collapse text-sm ${darkMode ? "border-white/10" : "border-gray-200"}`}
                  style={{ border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}>
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className={`px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide ${darkMode ? "bg-white/8 text-gray-200 border-white/10" : "bg-gray-100 text-gray-700 border-gray-200"}`}
                style={{ border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}>
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className={`px-3 py-2 ${darkMode ? "text-gray-300 border-white/8" : "text-gray-600 border-gray-100"}`}
                style={{ border: `1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}>
                {children}
              </td>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className={`my-3 pl-4 italic border-l-4 ${darkMode ? "border-violet-500 text-gray-300" : "border-violet-400 text-gray-500"}`}>
                {children}
              </blockquote>
            );
          },
          code({ inline, className, children, ...props }: {
            inline?: boolean; className?: string; children?: React.ReactNode;
          }) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <SyntaxHighlighter
                style={darkMode ? oneDark : oneLight}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  borderRadius: "12px",
                  padding: "16px 18px",
                  fontSize: "12.5px",
                  overflowX: "auto",
                  marginTop: "0.6rem",
                  marginBottom: "0.6rem",
                  border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                }}
                {...props}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code
                className={`px-1.5 py-0.5 rounded text-xs font-mono ${darkMode ? "bg-white/10 text-cyan-300" : "bg-violet-50 text-violet-700"}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          hr() {
            return <hr className={`my-4 ${darkMode ? "border-white/10" : "border-gray-200"}`} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
