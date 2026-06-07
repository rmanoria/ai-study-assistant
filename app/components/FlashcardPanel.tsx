"use client";

import { useState } from "react";
import { Loader2, Layers, ChevronLeft, ChevronRight, Shuffle } from "lucide-react";

type Flashcard = { q: string; a: string; tag: string };
type ViewMode = "grid" | "study";

export default function FlashcardPanel() {
  const [topic, setTopic]     = useState("");
  const [count, setCount]     = useState(8);
  const [cards, setCards]     = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [studyIdx, setStudyIdx] = useState(0);
  const [studyFlipped, setStudyFlipped] = useState(false);

  async function generate() {
    if (!topic.trim()) return;
    const validCount = Math.max(1, Math.min(50, Number(count) || 8));
    setLoading(true);
    setError("");
    setCards([]);
    setFlipped(new Set());
    setStudyIdx(0);
    setStudyFlipped(false);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "flashcards",
          payload: {
            topic,
            count: String(validCount),
            // Explicit instruction in prompt to enforce count
            instruction: `Generate EXACTLY ${validCount} flashcards, no more, no less.`,
          },
        }),
      });
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        // Enforce exact count client-side: pad or trim
        let result: Flashcard[] = data.data;
        if (result.length > validCount) {
          result = result.slice(0, validCount);
        } else if (result.length < validCount && result.length > 0) {
          // If API returned fewer, note it but show what we have
          console.warn(`Requested ${validCount}, got ${result.length}`);
        }
        setCards(result);
        setViewMode("grid");
      } else {
        setError("Failed to generate. Please try again.");
      }
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

  function shuffleCards() {
    setCards((prev) => [...prev].sort(() => Math.random() - 0.5));
    setFlipped(new Set());
    setStudyIdx(0);
    setStudyFlipped(false);
  }

  function studyNext() {
    setStudyFlipped(false);
    setTimeout(() => setStudyIdx((i) => Math.min(cards.length - 1, i + 1)), 150);
  }

  function studyPrev() {
    setStudyFlipped(false);
    setTimeout(() => setStudyIdx((i) => Math.max(0, i - 1)), 150);
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 overflow-y-auto flex-1 w-full">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30 shrink-0">
          <Layers size={18} className="text-violet-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-white">Flashcard Generator</h2>
          <p className="text-xs sm:text-sm text-gray-400">AI-powered study cards on any topic</p>
        </div>
      </div>

      {/* Topic input */}
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && generate()}
        placeholder="Topic (e.g. Photosynthesis, The French Revolution, Calculus…)"
        className="w-full bg-white/5 border border-white/10 text-white placeholder:text-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-500/60 transition-colors"
      />

      {/* Count + Generate */}
      <div className="flex gap-2 items-center">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-violet-500/60 transition-colors">
          <span className="text-xs text-gray-400 whitespace-nowrap">Cards:</span>
          <input
            type="number" min={1} max={50} value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-10 bg-transparent text-white text-sm outline-none text-center font-semibold"
          />
          <div className="flex flex-col gap-0.5">
            <button onClick={() => setCount((c) => Math.min(50, c + 1))} className="text-gray-500 hover:text-violet-400 leading-none text-[10px] px-0.5">▲</button>
            <button onClick={() => setCount((c) => Math.max(1, c - 1))} className="text-gray-500 hover:text-violet-400 leading-none text-[10px] px-0.5">▼</button>
          </div>
        </div>
        <button onClick={generate} disabled={loading || !topic.trim()}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-sm font-semibold transition-all">
          {loading ? <Loader2 size={15} className="animate-spin" /> : "✦"}
          {loading ? `Generating ${count} cards…` : "Generate"}
        </button>
      </div>

      {/* Quick presets — wider range */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-gray-500 shrink-0">Quick:</span>
        {[5, 10, 15, 20, 25, 30, 40, 50].map((n) => (
          <button key={n} onClick={() => setCount(n)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
              ${count === n ? "bg-violet-600 border-violet-500 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:border-violet-500/40 hover:text-violet-300"}`}>
            {n}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Stats + view toggle */}
      {cards.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-3 gap-2 flex-1">
            {[
              { label: "Total",    value: cards.length },
              { label: "Reviewed", value: viewMode === "study" ? studyIdx + (studyFlipped ? 1 : 0) : flipped.size },
              { label: "Left",     value: viewMode === "study" ? cards.length - studyIdx - 1 : cards.length - flipped.size },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                <div className="text-lg sm:text-2xl font-bold text-white">{value}</div>
                <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {/* View toggle + shuffle */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <button onClick={() => setViewMode(viewMode === "grid" ? "study" : "grid")}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-gray-400 hover:text-white hover:border-violet-500/40 transition-colors whitespace-nowrap">
              {viewMode === "grid" ? "📖 Study" : "⊞ Grid"}
            </button>
            <button onClick={shuffleCards}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-gray-400 hover:text-white hover:border-violet-500/40 transition-colors flex items-center gap-1 justify-center">
              <Shuffle size={11} /> Shuffle
            </button>
          </div>
        </div>
      )}

      {/* ── STUDY MODE: one card at a time ── */}
      {cards.length > 0 && viewMode === "study" && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="text-xs text-gray-500 font-semibold">{studyIdx + 1} / {cards.length}</div>
          {/* Card */}
          <div
            className="w-full cursor-pointer"
            style={{ perspective: "1200px" }}
            onClick={() => setStudyFlipped((f) => !f)}
          >
            <div
              className="relative w-full transition-transform duration-500"
              style={{
                transformStyle: "preserve-3d",
                transform: studyFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                minHeight: "220px",
              }}
            >
              {/* Front */}
              <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-violet-500/40 transition-colors"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                <div className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">{cards[studyIdx].tag || "Study"}</div>
                <div className="text-base text-white leading-relaxed flex-1 flex items-center mt-3">{cards[studyIdx].q}</div>
                <div className="text-[11px] text-gray-500 mt-3">Tap to reveal answer</div>
              </div>
              {/* Back */}
              <div className="absolute inset-0 bg-violet-600/10 border border-violet-500/30 rounded-2xl p-6 flex flex-col justify-between"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Answer</div>
                <div className="text-base text-cyan-200 leading-relaxed flex-1 flex items-center mt-3">{cards[studyIdx].a}</div>
                <div className="text-[11px] text-gray-500 mt-3">Tap to flip back</div>
              </div>
            </div>
          </div>
          {/* Nav */}
          <div className="flex items-center gap-3 w-full">
            <button onClick={studyPrev} disabled={studyIdx === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all text-sm font-medium flex-1 justify-center">
              <ChevronLeft size={16} /> Prev
            </button>
            <button onClick={studyNext} disabled={studyIdx === cards.length - 1}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 transition-all text-sm font-medium flex-1 justify-center">
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── GRID MODE ── */}
      {cards.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {cards.map((card, i) => (
            <div key={i} onClick={() => toggleFlip(i)} className="cursor-pointer" style={{ perspective: "1000px" }}>
              <div
                className="relative transition-transform duration-500"
                style={{
                  transformStyle: "preserve-3d",
                  transform: flipped.has(i) ? "rotateY(180deg)" : "rotateY(0deg)",
                  minHeight: "160px",
                }}
              >
                <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-violet-500/40 transition-colors"
                  style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                  <div className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">{card.tag || "Study"}</div>
                  <div className="text-sm text-white leading-relaxed mt-2 flex-1 flex items-center">{card.q}</div>
                  <div className="text-[10px] text-gray-500 mt-2">Tap to reveal answer</div>
                </div>
                <div className="absolute inset-0 bg-violet-600/10 border border-violet-500/30 rounded-2xl p-4 flex flex-col justify-between"
                  style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Answer</div>
                  <div className="text-sm text-cyan-200 leading-relaxed mt-2 flex-1 flex items-center">{card.a}</div>
                  <div className="text-[10px] text-gray-500 mt-2">✓ Got it</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && cards.length === 0 && !error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
          <div className="text-5xl mb-2">🃏</div>
          <div className="text-white font-semibold text-lg">Create your first deck</div>
          <div className="text-gray-400 text-sm max-w-xs">
            Enter any topic, set how many cards you want (up to 50), and StudyAI generates your deck instantly.
          </div>
        </div>
      )}
    </div>
  );
}
