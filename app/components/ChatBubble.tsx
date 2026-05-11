import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBubble({ role, content }: Props) {
  return (
    <div
      className={`max-w-[80%] rounded-3xl px-5 py-4 backdrop-blur-xl border shadow-2xl ${
        role === "user"
          ? "ml-auto bg-blue-500/20 border-blue-500/20"
          : "bg-white/10 border-white/10"
      }`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}