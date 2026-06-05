"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import ChatBubble from "./ChatBubble";

const STYLES = [
  { id: "concise",  label: "📌 Concise" },
  { id: "bullets",  label: "• Bullet Points" },
  { id: "academic", label: "🎓 Academic" },
  { id: "eli5",     label: "🧒 ELI5" },
  { id: "mindmap",  label: "🗺 Key Concepts" },
];

export default function SummarizerPanel() {
  const [input, setInput]   = useState("");
  const [style, setStyle]   = useState("concise");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function summarize() {
    if (!input.trim()) return;
    setLoading(true);
    setResult("");

    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "summarize", payload: { text: input, style } }),
      });
      const data = await res.json();
      setResult(data.text || "Failed to summarize.");
    } catch {
      setResult("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const wordCount = input.split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5 p-6 overflow-y-auto flex-1">

      {/* Header — matches Flashcard / Quiz pattern */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-green-500/20 border border-green-500/30">
          <Zap size={20} className="text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">AI Summarizer</h2>
          <p className="text-sm text-gray-400">
            Paste any text and get an instant AI summary
          </p>
        </div>
      </div>

      {/* Style picker */}
      <div className="flex flex-wrap gap-2">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStyle(s.id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all
              ${style === s.id
                ? "bg-green-600 border-green-600 text-white"
                : "bg-white/5 border-white/10 text-gray-400 hover:border-green-500/40 hover:text-green-300"
              }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste your lecture notes, article, textbook content, or any text here…"
        className="bg-white/5 border border-white/10 text-gray-200 text-sm placeholder:text-gray-600 rounded-2xl px-5 py-4 outline-none focus:border-green-500/50 transition-colors resize-none min-h-45 leading-relaxed"
      />

      {/* Action row */}
      <div className="flex items-center gap-3">
        <button
          onClick={summarize}
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-sm font-semibold transition-all"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : "⚡"}
          {loading ? "Summarizing…" : "Summarize with AI"}
        </button>

        {wordCount > 0 && (
          <span className="text-xs text-gray-500">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-3">
            Summary
          </div>
          <ChatBubble role="assistant" content={result} darkMode={true} />
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
          <div className="text-5xl mb-2">⚡</div>
          <div className="text-white font-semibold text-lg">Summarize anything instantly</div>
          <div className="text-gray-400 text-sm max-w-xs">
            Paste up to thousands of words. AI will distill it into exactly the format you choose.
          </div>
        </div>
      )}

    </div>
  );
}
