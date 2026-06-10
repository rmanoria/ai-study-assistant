"use client";

import { useState } from "react";
import { Loader2, Layers, ChevronLeft, ChevronRight, Shuffle, Trophy } from "lucide-react";

type Flashcard  = { q: string; a: string; tag: string; hint?: string };
type ViewMode   = "grid" | "study" | "results";
type Difficulty = "easy" | "medium" | "hard" | "mixed";

const DIFFICULTY_CFG = {
  easy:   { label: "Easy",   emoji: "🟢", active: "bg-emerald-600/20 border-emerald-500/50 text-emerald-400" },
  medium: { label: "Medium", emoji: "🟡", active: "bg-amber-600/20   border-amber-500/50   text-amber-400"   },
  hard:   { label: "Hard",   emoji: "🔴", active: "bg-red-600/20     border-red-500/50     text-red-400"     },
  mixed:  { label: "Mixed",  emoji: "🎲", active: "bg-violet-600/20  border-violet-500/50  text-violet-400"  },
};

const COUNT_PRESETS = [5, 8, 10, 15, 20, 25, 30, 40, 50];

export default function FlashcardPanel() {
  const [topic,        setTopic]        = useState("");
  const [count,        setCount]        = useState(10);
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
    const n = Math.max(1, Math.min(50, count));
    setLoading(true); setError(""); setCards([]); setFlipped(new Set()); setMastered(new Set()); setStudyIdx(0); setStudyFlipped(false); setShowHint(false);
    try {
      const res  = await fetch("/api/tools", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "flashcards", payload: {
          topic, count: String(n), difficulty,
          instruction: `Generate EXACTLY ${n} flashcards about "${topic}" at ${difficulty} difficulty. Each must have a short one-sentence hint. Return JSON array: [{"q":"...","a":"...","tag":"...","hint":"..."}]`,
        }}),
      });
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        setCards(data.data.slice(0, n));
        setViewMode("grid");
      } else { setError("Failed to generate. Please try again."); }
    } catch { setError("Connection error. Please check your API configuration."); }
    finally  { setLoading(false); }
  }

  function toggleFlip(i: number) { setFlipped(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; }); }
  function toggleMastered(i: number, e?: React.MouseEvent) { e?.stopPropagation(); setMastered(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; }); }
  function shuffleCards() { setCards(p => [...p].sort(() => Math.random() - 0.5)); setFlipped(new Set()); setMastered(new Set()); setStudyIdx(0); setStudyFlipped(false); setShowHint(false); }
  function studyNext() { setStudyFlipped(false); setShowHint(false); setTimeout(() => { if (studyIdx + 1 >= cards.length) setViewMode("results"); else setStudyIdx(i => i + 1); }, 150); }
  function studyPrev() { setStudyFlipped(false); setShowHint(false); setTimeout(() => setStudyIdx(i => Math.max(0, i - 1)), 150); }

  const masteredPct = cards.length ? Math.round((mastered.size / cards.length) * 100) : 0;
  const remaining   = cards.length - mastered.size;

  const baseInput = "w-full bg-white/5 border border-white/10 text-white placeholder:text-[#5a5a7a] rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-500/60 transition-colors";
  const btnInactive = "bg-white/5 border border-white/10 text-[#9a9ab8] hover:text-white hover:border-white/20";

  if (viewMode === "results") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 flex-1 p-8 text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
          style={{ background: "linear-gradient(135deg,#7c5af0,#22d3ee)" }}>
          <Trophy size={34} className="text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
          <p className="text-[#9a9ab8] text-sm mt-1">{cards.length} cards reviewed</p>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-emerald-400">{mastered.size}</div>
            <div className="text-xs text-[#9a9ab8] mt-1">Mastered</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-400">{remaining}</div>
            <div className="text-xs text-[#9a9ab8] mt-1">To Review</div>
          </div>
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <button onClick={() => { setStudyIdx(0); setStudyFlipped(false); setShowHint(false); setViewMode("study"); }}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all"
            style={{ background: "linear-gradient(135deg,#7c5af0,#22d3ee)" }}>
            Study Again
          </button>
          <button onClick={() => setViewMode("grid")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${btnInactive}`}>
            Grid View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 overflow-y-auto flex-1 w-full">

      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="p-2 rounded-xl shrink-0" style={{ background: "linear-gradient(135deg,rgba(124,90,240,0.2),rgba(34,211,238,0.1))", border: "1px solid rgba(124,90,240,0.3)" }}>
          <Layers size={18} className="text-violet-400" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Flashcard Generator</h2>
          <p className="text-xs text-[#9a9ab8]">AI-powered study cards with mastery tracking</p>
        </div>
      </div>

      {/* Topic */}
      <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && generate()}
        placeholder="Topic — e.g. Photosynthesis, French Revolution, Calculus…"
        className={baseInput} />

      {/* Difficulty */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[#5a5a7a] shrink-0 font-medium">Difficulty:</span>
        {(Object.keys(DIFFICULTY_CFG) as Difficulty[]).map(d => {
          const c = DIFFICULTY_CFG[d];
          return (
            <button key={d} onClick={() => setDifficulty(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                ${difficulty === d ? c.active : btnInactive}`}>
              {c.emoji} {c.label}
            </button>
          );
        })}
      </div>

      {/* Card count */}
      <div>
        <span className="text-xs text-[#5a5a7a] font-medium mb-2 block">Number of cards:</span>
        <div className="flex gap-2 flex-wrap">
          {COUNT_PRESETS.map(n => (
            <button key={n} onClick={() => setCount(n)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all min-w-10
                ${count === n ? "bg-violet-600/20 border-violet-500/50 text-violet-300" : btnInactive}`}>
              {n}
            </button>
          ))}
          {/* Custom input */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 focus-within:border-violet-500/50">
            <input type="number" min={1} max={50} value={count}
              onChange={e => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-10 bg-transparent text-white text-xs outline-none text-center font-semibold" />
            <span className="text-[10px] text-[#5a5a7a]">custom</span>
          </div>
        </div>
      </div>

      {/* Generate */}
      <button onClick={generate} disabled={loading || !topic.trim()}
        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
        style={{ background: "linear-gradient(135deg,#7c5af0,#5b8def)" }}>
        {loading ? <Loader2 size={15} className="animate-spin" /> : "✦"}
        {loading ? `Generating ${count} cards…` : `Generate ${count} Cards`}
      </button>

      {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>}

      {/* Stats */}
      {cards.length > 0 && (
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-[#9a9ab8]">Mastery Progress</span>
            <span className="text-xs font-bold text-white">{masteredPct}%</span>
          </div>
          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${masteredPct}%`, background: "linear-gradient(90deg,#7c5af0,#10b981)" }} />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { label: "Total",    value: cards.length,  color: "text-white" },
              { label: "Mastered", value: mastered.size, color: "text-emerald-400" },
              { label: "Left",     value: remaining,     color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-[10px] text-[#5a5a7a]">{label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setViewMode(viewMode === "grid" ? "study" : "grid"); setStudyIdx(0); setStudyFlipped(false); setShowHint(false); }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${btnInactive}`}>
              {viewMode === "grid" ? "📖 Study Mode" : "⊞ Grid View"}
            </button>
            <button onClick={shuffleCards}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${btnInactive}`}>
              <Shuffle size={11} /> Shuffle
            </button>
          </div>
        </div>
      )}

      {/* STUDY MODE */}
      {cards.length > 0 && viewMode === "study" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {cards.map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-300
                ${i === studyIdx ? "w-5 h-2 bg-violet-400" : mastered.has(i) ? "w-2 h-2 bg-emerald-500" : "w-2 h-2 bg-white/15"}`} />
            ))}
          </div>
          <div className="text-xs text-[#9a9ab8] font-semibold">{studyIdx + 1} / {cards.length}</div>

          <div className="w-full cursor-pointer" style={{ perspective: "1200px" }}
            onClick={() => { setStudyFlipped(f => !f); setShowHint(false); }}>
            <div className="relative w-full transition-transform duration-500"
              style={{ transformStyle: "preserve-3d", transform: studyFlipped ? "rotateY(180deg)" : "rotateY(0deg)", minHeight: "240px" }}>
              <div className="absolute inset-0 bg-white/4 border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-violet-500/35 transition-colors"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">{cards[studyIdx].tag || "Study"}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${DIFFICULTY_CFG[difficulty].active}`}>{difficulty}</span>
                </div>
                <div className="text-base text-white leading-relaxed flex-1 flex items-center mt-4">{cards[studyIdx].q}</div>
                {cards[studyIdx].hint && !showHint && (
                  <button onClick={e => { e.stopPropagation(); setShowHint(true); }}
                    className="mt-3 text-[11px] text-[#5a5a7a] hover:text-violet-400 transition-colors self-start">💡 Show hint</button>
                )}
                {showHint && cards[studyIdx].hint && (
                  <div className="mt-3 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl text-xs text-violet-300 italic">
                    💡 {cards[studyIdx].hint}
                  </div>
                )}
                <div className="text-[11px] text-[#5a5a7a] mt-3">Tap card to reveal answer</div>
              </div>
              <div className="absolute inset-0 bg-violet-600/10 border border-violet-500/30 rounded-2xl p-6 flex flex-col justify-between"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Answer</div>
                <div className="text-base text-cyan-100 leading-relaxed flex-1 flex items-center mt-4">{cards[studyIdx].a}</div>
                <button onClick={e => toggleMastered(studyIdx, e)}
                  className={`mt-3 self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                    ${mastered.has(studyIdx) ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-[#9a9ab8] hover:border-emerald-500/40 hover:text-emerald-400"}`}>
                  {mastered.has(studyIdx) ? "✓ Mastered" : "Mark as Mastered"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full">
            <button onClick={studyPrev} disabled={studyIdx === 0}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-medium flex-1 justify-center transition-all disabled:opacity-30 ${btnInactive}`}>
              <ChevronLeft size={16} /> Prev
            </button>
            <button onClick={studyNext}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium flex-1 justify-center transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#7c5af0,#22d3ee)" }}>
              {studyIdx === cards.length - 1 ? "Finish 🏆" : <>Next <ChevronRight size={16} /></>}
            </button>
          </div>
        </div>
      )}

      {/* GRID MODE */}
      {cards.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((card, i) => (
            <div key={i} onClick={() => toggleFlip(i)} className="cursor-pointer" style={{ perspective: "1000px" }}>
              <div className="relative transition-transform duration-500"
                style={{ transformStyle: "preserve-3d", transform: flipped.has(i) ? "rotateY(180deg)" : "rotateY(0deg)", minHeight: "164px" }}>
                <div className={`absolute inset-0 rounded-2xl p-4 flex flex-col justify-between border transition-colors
                  ${mastered.has(i) ? "bg-emerald-500/8 border-emerald-500/25" : "bg-white/4 border-white/10 hover:border-violet-500/35"}`}
                  style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">{card.tag || "Study"}</span>
                    {mastered.has(i) && <span className="text-[10px] text-emerald-400 font-bold">✓</span>}
                  </div>
                  <div className="text-sm text-white leading-relaxed mt-2 flex-1 flex items-center">{card.q}</div>
                  <div className="text-[10px] text-[#5a5a7a] mt-2">Tap to reveal</div>
                </div>
                <div className="absolute inset-0 bg-violet-600/10 border border-violet-500/30 rounded-2xl p-4 flex flex-col justify-between"
                  style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Answer</div>
                  <div className="text-sm text-cyan-100 leading-relaxed mt-2 flex-1 flex items-center">{card.a}</div>
                  <button onClick={e => toggleMastered(i, e)}
                    className={`mt-2 self-start px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all
                      ${mastered.has(i) ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-[#9a9ab8] hover:border-emerald-500/40 hover:text-emerald-400"}`}>
                    {mastered.has(i) ? "✓ Mastered" : "Mark Mastered"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && cards.length === 0 && !error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
          <div className="text-5xl mb-2">🃏</div>
          <div className="text-white font-semibold text-lg">Create your first deck</div>
          <div className="text-[#9a9ab8] text-sm max-w-xs">Enter any topic, choose difficulty, pick a card count, and StudyAI generates your deck instantly.</div>
        </div>
      )}
    </div>
  );
}
