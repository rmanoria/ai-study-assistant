"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Prism as SyntaxHighlighter,
} from "react-syntax-highlighter";

import {
  oneDark,
} from "react-syntax-highlighter/dist/esm/styles/prism";

type Props = {
  role: "user" | "assistant";
  content: string;
  darkMode?: boolean;
};

export default function ChatBubble({
  content,
  darkMode = true,
}: Props) {
  return (
    <div
      className={`
        prose max-w-none
        prose-headings:font-bold
        prose-h1:text-3xl
        prose-h2:text-2xl
        prose-h3:text-xl
        prose-p:leading-7
        prose-pre:p-0
        prose-img:rounded-xl
        prose-table:border
        prose-th:border
        prose-td:border
        prose-th:p-2
        prose-td:p-2
        prose-blockquote:border-l-4
        prose-blockquote:pl-4
        prose-blockquote:italic
        ${
          darkMode
            ? `
              prose-headings:text-white
              prose-p:text-gray-200
              prose-strong:text-white
              prose-li:text-gray-200
              prose-code:text-cyan-300
              prose-blockquote:text-gray-300
              prose-blockquote:border-gray-600
            `
            : `
              prose-headings:text-black
              prose-p:text-gray-800
              prose-strong:text-black
              prose-li:text-gray-800
              prose-code:text-blue-700
              prose-blockquote:text-gray-700
              prose-blockquote:border-gray-400
            `
        }
      `}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({
            inline,
            className,
            children,
            ...props
          }: any) {
            const match =
              /language-(\w+)/.exec(
                className || ""
              );

            return !inline && match ? (
             <SyntaxHighlighter
  style={oneDark}
  language={match[1]}
  PreTag="div"
  customStyle={{
    borderRadius: "16px",
    padding: "20px",
    fontSize: "14px",
    overflowX: "auto",
    marginTop: "1rem",
    marginBottom: "1rem",
  }}
>
                {String(children).replace(
                  /\n$/,
                  ""
                )}
              </SyntaxHighlighter>
            ) : (
              <code
                className={`
                  px-1.5 py-1 rounded-md text-sm
                  ${
                    darkMode
                      ? "bg-white/10"
                      : "bg-gray-200"
                  }
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