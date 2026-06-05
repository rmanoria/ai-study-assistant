"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type Props = {
  role: "user" | "assistant";
  content: string;
  darkMode?: boolean;
};

export default function ChatBubble({ content, darkMode = true }: Props) {
  return (
    <div
      className={`
        prose max-w-none
        prose-headings:font-semibold
        prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
        prose-p:leading-7 prose-p:mb-3
        prose-pre:p-0 prose-pre:bg-transparent
        prose-img:rounded-xl
        prose-table:border prose-th:border prose-td:border
        prose-th:p-2 prose-td:p-2
        prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic
        prose-li:mb-1
        ${
          darkMode
            ? `
              prose-headings:text-white
              prose-p:text-gray-200
              prose-strong:text-violet-300
              prose-li:text-gray-200
              prose-code:text-cyan-300
              prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-blockquote:text-gray-300 prose-blockquote:border-violet-500
              prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
              prose-th:bg-white/10 prose-th:text-white prose-td:text-gray-200
            `
            : `
              prose-headings:text-gray-900
              prose-p:text-gray-700
              prose-strong:text-violet-700
              prose-li:text-gray-700
              prose-code:text-violet-700
              prose-code:bg-violet-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-blockquote:text-gray-500 prose-blockquote:border-violet-400
              prose-a:text-violet-600 prose-a:no-underline hover:prose-a:underline
              prose-th:bg-gray-100 prose-th:text-gray-800 prose-td:text-gray-700
            `
        }
      `}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: {
            inline?: boolean;
            className?: string;
            children?: React.ReactNode;
          }) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  borderRadius: "12px",
                  padding: "18px",
                  fontSize: "13px",
                  overflowX: "auto",
                  marginTop: "0.75rem",
                  marginBottom: "0.75rem",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                {...props}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code
                className={`
                  px-1.5 py-0.5 rounded text-sm font-mono
                  ${darkMode ? "bg-white/10 text-cyan-300" : "bg-violet-50 text-violet-700"}
                `}
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
