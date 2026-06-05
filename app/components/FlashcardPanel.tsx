"use client";

import { useState } from "react";
import { Loader2, Layers } from "lucide-react";

type Flashcard = { q: string; a: string; tag: string };

export default function FlashcardPanel() {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (!topic.trim()) return;
    const validCount = Math.max(1, Math.min(50, count));
    setLoading(true);
    setError("");
    setCards([]);
    setFlipped(new Set());

    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "flashcards", payload: { topic, count: String(validCount) } }),
      });
      const data = await res.json();
      if (data.data) setCards(data.data);
      else setError("Failed to generate. Please try again.");
    } catch {
      setError("Connection error. Check your API key.");
    } finally {
      setLoading(false);
    }
  }

  function toggleFlip(i: number) {
    setFlipped((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5 p-6 overflow-y-auto flex-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30">
          <Layers size={20} className="text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Flashcard Generator</h2>
          <p className="text-sm text-gray-400">AI-powered study cards on any topic</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder="Topic (e.g. Photosynthesis, JavaScript, French Revolution…)"
          className="flex-1 min-w-55 bg-white/5 border border-white/10 text-white placeholder:text-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500/60 transition-colors"
        />

        {/* Custom count input */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-violet-500/60 transition-colors">
          <span className="text-xs text-gray-400 whitespace-nowrap">Cards:</span>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-14 bg-transparent text-white text-sm outline-none text-center font-semibold"
          />
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => setCount((c) => Math.min(50, c + 1))}
              className="text-gray-500 hover:text-violet-400 leading-none text-xs"
            >▲</button>
            <button
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              className="text-gray-500 hover:text-violet-400 leading-none text-xs"
            >▼</button>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading || !topic.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-sm font-semibold transition-all"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "✦"}
          {loading ? "Generating…" : "Generate Cards"}
        </button>
      </div>

      {/* Quick presets */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-gray-500 self-center">Quick:</span>
        {[5, 10, 15, 20, 30].map((n) => (
          <button
            key={n}
            onClick={() => setCount(n)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
              ${count === n
                ? "bg-violet-600 border-violet-500 text-white"
                : "bg-white/5 border-white/10 text-gray-400 hover:border-violet-500/40 hover:text-violet-300"
              }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Stats */}
      {cards.length > 0 && (
        <div className="flex gap-3">
          {[
            { label: "Total Cards", value: cards.length },
            { label: "Reviewed", value: flipped.size },
            { label: "Remaining", value: cards.length - flipped.size },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-center"
            >
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Cards Grid */}
      {cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map((card, i) => (
            <div
              key={i}
              onClick={() => toggleFlip(i)}
              className="cursor-pointer"
              style={{ perspective: "1000px" }}
            >
              <div
                className="relative transition-transform duration-500"
                style={{
                  transformStyle: "preserve-3d",
                  transform: flipped.has(i) ? "rotateY(180deg)" : "rotateY(0deg)",
                  minHeight: "140px",
                }}
              >
                {/* Front */}
                <div
                  className="absolute inset-0 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-violet-500/40 transition-colors"
                  style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                >
                  <div className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">
                    {card.tag || "Study"}
                  </div>
                  <div className="text-sm text-white leading-relaxed mt-2 flex-1 flex items-center">
                    {card.q}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-2">Tap to reveal answer</div>
                </div>

                {/* Back */}
                <div
                  className="absolute inset-0 bg-violet-600/10 border border-violet-500/30 rounded-2xl p-4 flex flex-col justify-between"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                    Answer
                  </div>
                  <div className="text-sm text-cyan-200 leading-relaxed mt-2 flex-1 flex items-center">
                    {card.a}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-2">✓ Got it</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && cards.length === 0 && !error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
          <div className="text-5xl mb-2">🃏</div>
          <div className="text-white font-semibold text-lg">Create your first flashcard deck</div>
          <div className="text-gray-400 text-sm max-w-xs">
            Enter any topic above, set how many cards you want, and AI will generate your deck instantly.
          </div>
        </div>
      )}
    </div>
  );
}
