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
};

export default function ChatBubble({
  role,
  content,
}: Props) {
  return (
    <div
      className="
        prose max-w-none
        prose-invert
        prose-headings:text-white
        prose-p:text-gray-200
        prose-strong:text-white
        prose-code:text-cyan-300
        prose-pre:p-0
        prose-li:text-gray-200
      "
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
            const match = /language-(\w+)/.exec(
              className || ""
            );

            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark as any}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(
                  /\n$/,
                  ""
                )}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-black/40 px-1 py-0.5 rounded text-cyan-300"
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