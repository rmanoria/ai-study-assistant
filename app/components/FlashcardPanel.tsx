"use client";

import { useState } from "react";
import { Loader2, Layers, ChevronLeft, ChevronRight, Shuffle, Trophy } from "lucide-react";

type Flashcard = { q: string; a: string; tag: string; hint?: string };
type ViewMode  = "grid" | "study" | "results";
type Difficulty = "easy" | "medium" | "hard" | "mixed";

export default function FlashcardPanel() {
  const [topic,        setTopic]        = useState("");
  const [count,        setCount]        = useState(8);
  const [difficulty,   setDifficulty]   = useState<Difficulty>("medium");
  const [cards,        setCards]        = useState<Flashcard[]>([]);
  const [flipped,      setFlipped]      = useState<Set<number>>(new Set());
  const [mastered,     setMastered]     = useState<Set<number>>(new Set());
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [viewMode,     setViewMode]     = useState<ViewMode>("grid");
  const [studyIdx,     setStudyIdx]     = useState(0);
  const [studyFlipped, setStudyFlipped] = useState(false);
  const [showHint,     setShowHint]     = useState(false);

  async function generate() {
    if (!topic.trim()) return;
    const validCount = Math.max(1, Math.min(50, Number(count) || 8));
    setLoading(true);
    setError("");
    setCards([]);
    setFlipped(new Set());
    setMastered(new Set());
    setStudyIdx(0);
    setStudyFlipped(false);
    setShowHint(false);

    try {
      const res  = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "flashcards",
          payload: {
            topic,
            count: String(validCount),
            difficulty,
            instruction: `Generate EXACTLY ${validCount} flashcards about "${topic}" at ${difficulty} difficulty. Each must have a short one-sentence hint field. Return JSON array: [{"q":"...","a":"...","tag":"...","hint":"..."}]`,
          },
        }),
      });
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        let result: Flashcard[] = data.data;
        if (result.length > validCount) result = result.slice(0, validCount);
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
    setFlipped((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  function toggleMastered(i: number, e?: React.MouseEvent) {
    e?.stopPropagation();
    setMastered((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  function shuffleCards() {
    setCards((prev) => [...prev].sort(() => Math.random() - 0.5));
    setFlipped(new Set());
    setMastered(new Set());
    setStudyIdx(0);
    setStudyFlipped(false);
    setShowHint(false);
  }

  function studyNext() {
    setStudyFlipped(false);
    setShowHint(false);
    setTimeout(() => {
      if (studyIdx + 1 >= cards.length) setViewMode("results");
      else setStudyIdx((i) => i + 1);
    }, 150);
  }

  function studyPrev() {
    setStudyFlipped(false);
    setShowHint(false);
    setTimeout(() => setStudyIdx((i) => Math.max(0, i - 1)), 150);
  }

  const masteredPct = cards.length ? Math.round((mastered.size / cards.length) * 100) : 0;
  const remaining   = cards.length - mastered.size;

  // ── RESULTS screen ──────────────────────────────────────────
  if (viewMode === "results") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 flex-1 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-linear-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-3xl shadow-lg">
          <Trophy size={36} className="text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
          <p className="text-gray-400 text-sm mt-1">{cards.length} cards reviewed</p>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
          <div className="bg-green-500/10 border border-green-500/25 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-green-400">{mastered.size}</div>
            <div className="text-xs text-gray-400 mt-1">Mastered</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-400">{remaining}</div>
            <div className="text-xs text-gray-400 mt-1">To Review</div>
          </div>
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => { setStudyIdx(0); setStudyFlipped(false); setShowHint(false); setViewMode("study"); }}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all"
          >🔄 Study Again</button>
          <button
            onClick={() => setViewMode("grid")}
            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-semibold hover:bg-white/10 transition-all"
          >⊞ Grid View</button>
        </div>
      </div>
    );
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
          <p className="text-xs sm:text-sm text-gray-400">AI-powered study cards with mastery tracking</p>
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

      {/* Difficulty selector */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-gray-500 self-center shrink-0">Difficulty:</span>
        {(["easy","medium","hard","mixed"] as Difficulty[]).map((d) => {
          const cfg = {
            easy:   { label: "🟢 Easy",   active: "bg-emerald-600 border-emerald-500 text-white" },
            medium: { label: "🟡 Medium", active: "bg-amber-600   border-amber-500   text-white" },
            hard:   { label: "🔴 Hard",   active: "bg-red-600     border-red-500     text-white" },
            mixed:  { label: "🎲 Mixed",  active: "bg-violet-600  border-violet-500  text-white" },
          }[d];
          return (
            <button key={d} onClick={() => setDifficulty(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                ${difficulty === d ? cfg.active : "bg-white/5 border-white/10 text-gray-400 hover:text-white"}`}>
              {cfg.label}
            </button>
          );
        })}
      </div>

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
          {loading ? `Generating ${count} cards…` : "Generate Cards"}
        </button>
      </div>

      {/* Quick presets */}
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

      {/* Stats + controls */}
      {cards.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Mastery progress bar */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-gray-400">Mastery Progress</span>
              <span className="text-xs font-bold text-white">{masteredPct}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-violet-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${masteredPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-emerald-400">{mastered.size} mastered</span>
              <span className="text-[10px] text-amber-400">{remaining} remaining</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="grid grid-cols-3 gap-2 flex-1">
              {[
                { label: "Total",    value: cards.length,  color: "text-white" },
                { label: "Mastered", value: mastered.size, color: "text-emerald-400" },
                { label: "Left",     value: remaining,     color: "text-amber-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                  <div className={`text-lg sm:text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button onClick={() => { setViewMode(viewMode === "grid" ? "study" : "grid"); setStudyIdx(0); setStudyFlipped(false); setShowHint(false); }}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-gray-400 hover:text-white hover:border-violet-500/40 transition-colors whitespace-nowrap">
                {viewMode === "grid" ? "📖 Study" : "⊞ Grid"}
              </button>
              <button onClick={shuffleCards}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-gray-400 hover:text-white hover:border-violet-500/40 transition-colors flex items-center gap-1 justify-center">
                <Shuffle size={11} /> Shuffle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STUDY MODE ── */}
      {cards.length > 0 && viewMode === "study" && (
        <div className="flex flex-col items-center gap-4 py-2">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {cards.map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-300
                ${i === studyIdx ? "w-4 h-2 bg-violet-400" : mastered.has(i) ? "w-2 h-2 bg-emerald-500" : "w-2 h-2 bg-white/15"}`} />
            ))}
          </div>
          <div className="text-xs text-gray-500 font-semibold">{studyIdx + 1} / {cards.length}</div>

          {/* Card */}
          <div className="w-full cursor-pointer" style={{ perspective: "1200px" }}
            onClick={() => { setStudyFlipped((f) => !f); setShowHint(false); }}>
            <div className="relative w-full transition-transform duration-500"
              style={{ transformStyle: "preserve-3d", transform: studyFlipped ? "rotateY(180deg)" : "rotateY(0deg)", minHeight: "240px" }}>
              {/* Front */}
              <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-violet-500/40 transition-colors"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">{cards[studyIdx].tag || "Study"}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    difficulty === "easy"  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                    difficulty === "hard"  ? "text-red-400 border-red-500/30 bg-red-500/10" :
                    difficulty === "mixed" ? "text-violet-400 border-violet-500/30 bg-violet-500/10" :
                    "text-amber-400 border-amber-500/30 bg-amber-500/10"}`}>
                    {difficulty}
                  </span>
                </div>
                <div className="text-base text-white leading-relaxed flex-1 flex items-center mt-4">{cards[studyIdx].q}</div>
                {/* Hint */}
                {cards[studyIdx].hint && !showHint && (
                  <button onClick={(e) => { e.stopPropagation(); setShowHint(true); }}
                    className="mt-3 text-[11px] text-gray-500 hover:text-violet-400 transition-colors self-start">
                    💡 Show hint
                  </button>
                )}
                {showHint && cards[studyIdx].hint && (
                  <div className="mt-3 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl text-xs text-violet-300 italic">
                    💡 {cards[studyIdx].hint}
                  </div>
                )}
                <div className="text-[11px] text-gray-500 mt-3">Tap to reveal answer</div>
              </div>
              {/* Back */}
              <div className="absolute inset-0 bg-violet-600/10 border border-violet-500/30 rounded-2xl p-6 flex flex-col justify-between"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Answer</div>
                <div className="text-base text-cyan-100 leading-relaxed flex-1 flex items-center mt-4">{cards[studyIdx].a}</div>
                <button
                  onClick={(e) => toggleMastered(studyIdx, e)}
                  className={`mt-3 self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                    ${mastered.has(studyIdx)
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-emerald-500/40 hover:text-emerald-400"}`}>
                  {mastered.has(studyIdx) ? "✓ Mastered" : "Mark as Mastered"}
                </button>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div className="flex items-center gap-3 w-full">
            <button onClick={studyPrev} disabled={studyIdx === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all text-sm font-medium flex-1 justify-center">
              <ChevronLeft size={16} /> Prev
            </button>
            <button onClick={studyNext}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-all text-sm font-medium flex-1 justify-center">
              {studyIdx === cards.length - 1 ? "Finish 🏆" : <>Next <ChevronRight size={16} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── GRID MODE ── */}
      {cards.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {cards.map((card, i) => (
            <div key={i} onClick={() => toggleFlip(i)} className="cursor-pointer" style={{ perspective: "1000px" }}>
              <div className="relative transition-transform duration-500"
                style={{ transformStyle: "preserve-3d", transform: flipped.has(i) ? "rotateY(180deg)" : "rotateY(0deg)", minHeight: "170px" }}>
                {/* Front */}
                <div
                  className={`absolute inset-0 rounded-2xl p-4 flex flex-col justify-between transition-colors border
                    ${mastered.has(i)
                      ? "bg-emerald-500/8 border-emerald-500/25"
                      : "bg-white/5 border-white/10 hover:border-violet-500/40"}`}
                  style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">{card.tag || "Study"}</span>
                    {mastered.has(i) && <span className="text-[10px] font-bold text-emerald-400">✓ Mastered</span>}
                  </div>
                  <div className="text-sm text-white leading-relaxed mt-2 flex-1 flex items-center">{card.q}</div>
                  <div className="text-[10px] text-gray-500 mt-2">Tap to reveal</div>
                </div>
                {/* Back */}
                <div className="absolute inset-0 bg-violet-600/10 border border-violet-500/30 rounded-2xl p-4 flex flex-col justify-between"
                  style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Answer</div>
                  <div className="text-sm text-cyan-100 leading-relaxed mt-2 flex-1 flex items-center">{card.a}</div>
                  <button
                    onClick={(e) => toggleMastered(i, e)}
                    className={`mt-2 self-start flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all
                      ${mastered.has(i)
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                        : "bg-white/5 border-white/10 text-gray-400 hover:border-emerald-500/40 hover:text-emerald-400"}`}>
                    {mastered.has(i) ? "✓ Mastered" : "Mark Mastered"}
                  </button>
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
            Enter any topic, choose difficulty, set how many cards you want (up to 50), and StudyAI generates your deck instantly.
          </div>
        </div>
      )}
    </div>
  );
}