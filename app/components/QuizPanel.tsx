"use client";

import { useState } from "react";
import { Loader2, Brain } from "lucide-react";

type Question = { q: string; opts: string[]; ans: number; explain: string };
type Phase = "setup" | "active" | "result";

export default function QuizPanel() {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [difficulty, setDifficulty] = useState("medium");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startQuiz() {
    if (!topic.trim()) return;
    const validCount = Math.max(1, Math.min(30, count));
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "quiz", payload: { topic, count: String(validCount), difficulty } }),
      });
      const data = await res.json();
      if (data.data) {
        setQuestions(data.data);
        setIdx(0); setScore(0); setSelected(null);
        setPhase("active");
      } else setError("Failed to generate quiz. Try again.");
    } catch { setError("Connection error."); }
    finally { setLoading(false); }
  }

  function answer(i: number) {
    if (selected !== null) return;
    setSelected(i);
    if (i === questions[idx].ans) setScore((s) => s + 1);
    setTimeout(() => {
      setSelected(null);
      if (idx + 1 >= questions.length) setPhase("result");
      else setIdx((n) => n + 1);
    }, 2000);
  }

  function reset() {
    setPhase("setup"); setQuestions([]); setIdx(0); setScore(0); setSelected(null);
  }

  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 overflow-y-auto flex-1 w-full">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 shrink-0">
          <Brain size={18} className="text-cyan-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-white">Quiz Generator</h2>
          <p className="text-xs sm:text-sm text-gray-400">Test your knowledge with AI-generated quizzes</p>
        </div>
      </div>

      {/* ── SETUP ── */}
      {phase === "setup" && (
        <div className="flex flex-col gap-4 w-full">
          {/* Topic */}
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startQuiz()}
            placeholder="Quiz topic (e.g. Cell Biology, JavaScript…)"
            className="w-full bg-white/5 border border-white/10 text-white placeholder:text-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-500/60 transition-colors"
          />

          {/* Count + Difficulty — stacked on mobile, side-by-side on sm+ */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-cyan-500/60 transition-colors flex-1">
              <span className="text-xs text-gray-400 whitespace-nowrap">Questions:</span>
              <input
                type="number" min={1} max={30} value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="flex-1 bg-transparent text-white text-sm outline-none text-center font-semibold min-w-0"
              />
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => setCount((c) => Math.min(30, c + 1))} className="text-gray-500 hover:text-cyan-400 leading-none text-[10px] px-0.5">▲</button>
                <button onClick={() => setCount((c) => Math.max(1, c - 1))} className="text-gray-500 hover:text-cyan-400 leading-none text-[10px] px-0.5">▼</button>
              </div>
            </div>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="flex-1 bg-[#1a1a2e] border border-white/15 text-white rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer"
              style={{ colorScheme: "dark" }}
            >
              <option value="easy">🟢 Easy</option>
              <option value="medium">🟡 Medium</option>
              <option value="hard">🔴 Hard</option>
              <option value="mixed">🎲 Mixed</option>
            </select>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-gray-500 shrink-0">Quick:</span>
            {[5, 10, 15, 20, 25, 30].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
                  ${count === n ? "bg-cyan-600 border-cyan-500 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:border-cyan-500/40 hover:text-cyan-300"}`}
              >{n}</button>
            ))}
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
          )}

          <button
            onClick={startQuiz}
            disabled={loading || !topic.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-sm font-semibold transition-all"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "🧠"}
            {loading ? `Generating ${count} question${count !== 1 ? "s" : ""}…` : `Start Quiz (${count} Q${count !== 1 ? "s" : ""})`}
          </button>

          {!loading && (
            <div className="flex flex-col items-center gap-3 text-center py-10">
              <div className="text-5xl">🎯</div>
              <div className="text-white font-semibold text-lg">Ready to test yourself?</div>
              <div className="text-gray-400 text-sm max-w-xs">
                Enter a topic, pick your settings, and AI generates a full quiz with explanations.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVE ── */}
      {phase === "active" && questions.length > 0 && (
        <div className="flex flex-col gap-4 w-full">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${(idx / questions.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 shrink-0 font-semibold tabular-nums">{idx + 1}/{questions.length}</span>
          </div>

          {/* Score tracker */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Correct", value: score, color: "text-green-400" },
              { label: "Wrong",   value: idx - score, color: "text-red-400" },
              { label: "Left",    value: questions.length - idx, color: "text-gray-300" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-center">
                <div className={`text-lg font-bold ${color}`}>{value}</div>
                <div className="text-[10px] text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          {/* Question card */}
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6">
            <div className="text-[10px] text-cyan-400 font-semibold uppercase tracking-widest mb-2">Question {idx + 1}</div>
            <div className="text-white text-sm sm:text-base leading-relaxed font-medium">{questions[idx].q}</div>
          </div>

          {/* Options — single col on mobile, 2-col on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full">
            {questions[idx].opts.map((opt, i) => {
              let cls = "text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all w-full ";
              if (selected === null) cls += "bg-white/5 border-white/10 text-gray-200 hover:border-cyan-500/50 hover:bg-cyan-500/10 cursor-pointer active:scale-[0.98]";
              else if (i === questions[idx].ans) cls += "bg-green-500/15 border-green-500/60 text-green-300";
              else if (i === selected) cls += "bg-red-500/15 border-red-500/60 text-red-300";
              else cls += "bg-white/3 border-white/5 text-gray-500 cursor-default";
              return (
                <button key={i} className={cls} onClick={() => answer(i)} disabled={selected !== null}>
                  <span className="font-bold mr-2 opacity-50">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {selected !== null && questions[idx].explain && (
            <div className="w-full bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-3 text-sm text-gray-300">
              💡 <strong className="text-violet-300">Explanation:</strong> {questions[idx].explain}
            </div>
          )}
        </div>
      )}

      {/* ── RESULT ── */}
      {phase === "result" && (
        <div className="flex flex-col items-center gap-5 text-center w-full py-6">
          <div
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-violet-500 flex flex-col items-center justify-center shadow-lg shadow-violet-500/20"
            style={{ background: "rgba(139,92,246,0.12)" }}
          >
            <div className="text-3xl sm:text-4xl font-extrabold text-violet-300">{pct}%</div>
            <div className="text-xs text-gray-400">score</div>
          </div>

          <div className="text-xl sm:text-2xl font-bold text-white">
            {pct >= 80 ? "Excellent work! 🎉" : pct >= 60 ? "Good job! 👍" : "Keep studying! 💪"}
          </div>
          <div className="text-gray-400 text-sm">{score} of {questions.length} correct</div>

          {/* Review */}
          <div className="w-full flex flex-col gap-3 mt-1">
            <div className="text-sm font-semibold text-gray-300 text-left">Review</div>
            {questions.map((q, i) => (
              <div key={i} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-left">
                <div className="text-xs text-gray-500 mb-1">Q{i + 1}</div>
                <div className="text-sm text-white font-medium mb-1.5">{q.q}</div>
                <div className="text-xs text-green-400">✓ {q.opts[q.ans]}</div>
              </div>
            ))}
          </div>

          <div className="w-full flex flex-col gap-3 mt-1">
            <button onClick={startQuiz} className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all">
              🔄 Retry Same Topic
            </button>
            <button onClick={reset} className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-sm font-medium transition-all">
              New Quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
