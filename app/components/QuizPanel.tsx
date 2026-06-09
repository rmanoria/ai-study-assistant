"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Brain, Clock, ChevronRight, Flame, AlertCircle } from "lucide-react";

type MCQQuestion   = { type: "mcq";         q: string; opts: string[]; ans: number;  explain: string };
type TFQuestion    = { type: "truefalse";    q: string;                 ans: boolean; explain: string };
type SAQuestion    = { type: "shortanswer";  q: string; keywords: string[];           explain: string; modelAnswer: string };
type Question      = MCQQuestion | TFQuestion | SAQuestion;
type Phase         = "setup" | "active" | "result";
type QType         = "mcq" | "truefalse" | "shortanswer" | "mixed";
type Difficulty    = "easy" | "medium" | "hard" | "mixed";

const WARN_SECS = 30; // per-question warning threshold

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function QuizPanel() {
  const [topic,      setTopic]      = useState("");
  const [count,      setCount]      = useState(8);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [qType,      setQType]      = useState<QType>("mcq");
  const [questions,  setQuestions]  = useState<Question[]>([]);
  const [phase,      setPhase]      = useState<Phase>("setup");
  const [idx,        setIdx]        = useState(0);
  const [score,      setScore]      = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  // Per-question state
  const [selectedMCQ,  setSelectedMCQ]  = useState<number | null>(null);
  const [selectedTF,   setSelectedTF]   = useState<boolean | null>(null);
  const [saInput,      setSaInput]      = useState("");
  const [saResult,     setSaResult]     = useState<"correct" | "wrong" | null>(null);
  const [showExplain,  setShowExplain]  = useState(false);

  // Streak
  const [streak,       setStreak]       = useState(0);
  const [maxStreak,    setMaxStreak]     = useState(0);

  // Wrong answers for review
  const [wrongIdxs,    setWrongIdxs]    = useState<number[]>([]);

  // Timers
  const [sessionSecs,  setSessionSecs]  = useState(0);
  const [questionSecs, setQuestionSecs] = useState(0);
  const sessionRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qSecsRef    = useRef(0);

  // Result tab
  const [resultTab, setResultTab] = useState<"overview" | "wrong" | "all">("overview");

  useEffect(() => () => { clearInterval(sessionRef.current!); clearInterval(questionRef.current!); }, []);

  function startSessionTimer() {
    setSessionSecs(0);
    clearInterval(sessionRef.current!);
    sessionRef.current = setInterval(() => setSessionSecs(s => s + 1), 1000);
  }
  function resetQuestionTimer() {
    setQuestionSecs(0); qSecsRef.current = 0;
    clearInterval(questionRef.current!);
    questionRef.current = setInterval(() => { qSecsRef.current += 1; setQuestionSecs(qSecsRef.current); }, 1000);
  }
  function stopAllTimers() {
    clearInterval(sessionRef.current!);
    clearInterval(questionRef.current!);
  }

  // ── Generate quiz ─────────────────────────────────────────────
  async function startQuiz() {
    if (!topic.trim()) return;
    const validCount = Math.max(1, Math.min(30, Number(count) || 8));
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "quiz", payload: { topic, count: String(validCount), difficulty, qType } }),
      });
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        const qs: Question[] = data.data.slice(0, validCount);
        setQuestions(qs);
        setIdx(0); setScore(0); setStreak(0); setMaxStreak(0); setWrongIdxs([]);
        setSelectedMCQ(null); setSelectedTF(null); setSaInput(""); setSaResult(null); setShowExplain(false);
        setPhase("active");
        setResultTab("overview");
        startSessionTimer();
        resetQuestionTimer();
      } else {
        setError("Failed to generate quiz. Try again.");
      }
    } catch { setError("Connection error."); }
    finally { setLoading(false); }
  }

  function recordAnswer(correct: boolean) {
    clearInterval(questionRef.current!);
    setShowExplain(true);
    if (correct) {
      setScore(s => s + 1);
      setStreak(s => { const n = s + 1; setMaxStreak(m => Math.max(m, n)); return n; });
    } else {
      setStreak(0);
      setWrongIdxs(prev => [...prev, idx]);
    }
  }

  function answerMCQ(i: number) {
    if (selectedMCQ !== null || selectedTF !== null || saResult !== null) return;
    setSelectedMCQ(i);
    const q = questions[idx] as MCQQuestion;
    recordAnswer(i === q.ans);
  }

  function answerTF(val: boolean) {
    if (selectedMCQ !== null || selectedTF !== null || saResult !== null) return;
    setSelectedTF(val);
    const q = questions[idx] as TFQuestion;
    recordAnswer(val === q.ans);
  }

  function checkShortAnswer() {
    if (!saInput.trim()) return;
    const q = questions[idx] as SAQuestion;
    const lower = saInput.toLowerCase();
    const correct = q.keywords.some(k => lower.includes(k.toLowerCase()));
    setSaResult(correct ? "correct" : "wrong");
    recordAnswer(correct);
  }

  function nextQuestion() {
    setSelectedMCQ(null); setSelectedTF(null); setSaInput(""); setSaResult(null); setShowExplain(false);
    if (idx + 1 >= questions.length) { stopAllTimers(); setPhase("result"); }
    else { setIdx(n => n + 1); resetQuestionTimer(); }
  }

  function reset() {
    stopAllTimers();
    setPhase("setup"); setQuestions([]); setIdx(0); setScore(0);
    setSelectedMCQ(null); setSelectedTF(null); setSaInput(""); setSaResult(null);
    setShowExplain(false); setSessionSecs(0); setQuestionSecs(0);
    setStreak(0); setMaxStreak(0); setWrongIdxs([]);
  }

  const answered  = selectedMCQ !== null || selectedTF !== null || saResult !== null;
  const pct       = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const timeWarn  = questionSecs >= WARN_SECS && !answered;
  const currentQ  = questions[idx];

  // ── SETUP ─────────────────────────────────────────────────────
  if (phase === "setup") return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 overflow-y-auto flex-1 w-full">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 shrink-0">
          <Brain size={18} className="text-cyan-400" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Quiz Generator</h2>
          <p className="text-xs sm:text-sm text-gray-400">AI-powered quizzes with explanations</p>
        </div>
      </div>

      <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && startQuiz()}
        placeholder="Quiz topic (e.g. Cell Biology, World War II, React Hooks…)"
        className="w-full bg-white/5 border border-white/10 text-white placeholder:text-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-500/60 transition-colors" />

      {/* Question type */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-2">Question Type</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            { v: "mcq",         label: "📋 Multiple Choice" },
            { v: "truefalse",   label: "✓/✗ True / False"   },
            { v: "shortanswer", label: "✏️ Short Answer"      },
            { v: "mixed",       label: "🎲 Mixed Types"       },
          ] as { v: QType; label: string }[]).map(({ v, label }) => (
            <button key={v} onClick={() => setQType(v)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all
                ${qType === v ? "bg-cyan-600 border-cyan-500 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-cyan-500/40"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-cyan-500/60 transition-colors flex-1">
          <span className="text-xs text-gray-400 whitespace-nowrap">Questions:</span>
          <input type="number" min={1} max={30} value={count}
            onChange={e => setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            className="flex-1 bg-transparent text-white text-sm outline-none text-center font-semibold min-w-0" />
          <div className="flex flex-col gap-0.5 shrink-0">
            <button onClick={() => setCount(c => Math.min(30, c + 1))} className="text-gray-500 hover:text-cyan-400 leading-none text-[10px] px-0.5">▲</button>
            <button onClick={() => setCount(c => Math.max(1, c - 1))} className="text-gray-500 hover:text-cyan-400 leading-none text-[10px] px-0.5">▼</button>
          </div>
        </div>
        <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}
          className="flex-1 bg-[#1a1a2e] border border-white/15 text-white rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer" style={{ colorScheme: "dark" }}>
          <option value="easy">🟢 Easy</option>
          <option value="medium">🟡 Medium</option>
          <option value="hard">🔴 Hard</option>
          <option value="mixed">🎲 Mixed</option>
        </select>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-gray-500 shrink-0">Quick:</span>
        {[5,10,15,20,25,30].map(n => (
          <button key={n} onClick={() => setCount(n)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
              ${count === n ? "bg-cyan-600 border-cyan-500 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:border-cyan-500/40 hover:text-cyan-300"}`}>{n}</button>
        ))}
      </div>

      {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>}

      <button onClick={startQuiz} disabled={loading || !topic.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-sm font-semibold transition-all">
        {loading ? <Loader2 size={16} className="animate-spin" /> : "🧠"}
        {loading ? `Generating ${count} questions…` : `Start Quiz (${count} Q${count !== 1 ? "s" : ""})`}
      </button>

      {!loading && (
        <div className="flex flex-col items-center gap-3 text-center py-8">
          <div className="text-5xl">🎯</div>
          <div className="text-white font-semibold text-lg">Ready to test yourself?</div>
          <div className="text-gray-400 text-sm max-w-xs">Choose a question type, enter your topic, and start quizzing.</div>
        </div>
      )}
    </div>
  );

  // ── ACTIVE ────────────────────────────────────────────────────
  if (phase === "active" && questions.length > 0) return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 overflow-y-auto flex-1 w-full">

      {/* Timers + streak */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tabular-nums border transition-colors
          ${timeWarn ? "bg-red-500/15 border-red-500/40 text-red-300" : "bg-white/5 border-white/10 text-gray-400"}`}>
          {timeWarn ? <AlertCircle size={12} className="text-red-400" /> : <Clock size={12} className="text-cyan-400" />}
          <span className={timeWarn ? "text-red-300" : "text-cyan-300"}>{formatTime(questionSecs)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold tabular-nums">
          <Clock size={12} className="text-violet-400" />
          <span className="text-violet-300">{formatTime(sessionSecs)}</span>
        </div>
        {streak >= 2 && (
          <div className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 rounded-xl text-xs font-bold text-orange-300">
            <Flame size={12} className="text-orange-400" /> {streak} streak!
          </div>
        )}
        <div className="ml-auto text-xs text-gray-500 font-semibold tabular-nums">{idx + 1}/{questions.length}</div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-linear-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-500"
          style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>

      {/* Score tracker */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Correct", value: score,                  color: "text-green-400" },
          { label: "Wrong",   value: idx - score,            color: "text-red-400" },
          { label: "Left",    value: questions.length - idx, color: "text-gray-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-center">
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Question type badge + card */}
      <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-widest">Question {idx + 1}</span>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border
            ${currentQ.type === "mcq"         ? "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" :
              currentQ.type === "truefalse"   ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                                                "text-purple-400 border-purple-500/30 bg-purple-500/10"}`}>
            {currentQ.type === "mcq" ? "Multiple Choice" : currentQ.type === "truefalse" ? "True / False" : "Short Answer"}
          </span>
        </div>
        <div className="text-white text-sm sm:text-base leading-relaxed font-medium">{currentQ.q}</div>
      </div>

      {/* ── MCQ options ── */}
      {currentQ.type === "mcq" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full">
          {(currentQ as MCQQuestion).opts.map((opt, i) => {
            let cls = "text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all w-full ";
            if (selectedMCQ === null)
              cls += "bg-white/5 border-white/10 text-gray-200 hover:border-cyan-500/50 hover:bg-cyan-500/10 cursor-pointer active:scale-[0.98]";
            else if (i === (currentQ as MCQQuestion).ans)
              cls += "bg-green-500/15 border-green-500/60 text-green-300";
            else if (i === selectedMCQ)
              cls += "bg-red-500/15 border-red-500/60 text-red-300";
            else
              cls += "bg-white/3 border-white/5 text-gray-500 cursor-default";
            return (
              <button key={i} className={cls} onClick={() => answerMCQ(i)} disabled={selectedMCQ !== null}>
                <span className="font-bold mr-2 opacity-50">{String.fromCharCode(65 + i)}.</span>{opt}
              </button>
            );
          })}
        </div>
      )}

      {/* ── True / False ── */}
      {currentQ.type === "truefalse" && (
        <div className="grid grid-cols-2 gap-3 w-full">
          {([true, false] as const).map(val => {
            const q = currentQ as TFQuestion;
            const isCorrect = val === q.ans;
            const isSelected = selectedTF === val;
            let cls = "py-4 rounded-xl border text-sm font-bold transition-all ";
            if (selectedTF === null)
              cls += "bg-white/5 border-white/10 text-gray-200 hover:border-cyan-500/50 hover:bg-cyan-500/10 cursor-pointer active:scale-[0.98]";
            else if (isCorrect)
              cls += "bg-green-500/15 border-green-500/60 text-green-300";
            else if (isSelected)
              cls += "bg-red-500/15 border-red-500/60 text-red-300";
            else
              cls += "bg-white/3 border-white/5 text-gray-500 cursor-default";
            return (
              <button key={String(val)} className={cls} onClick={() => answerTF(val)} disabled={selectedTF !== null}>
                {val ? "✓ True" : "✗ False"}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Short Answer ── */}
      {currentQ.type === "shortanswer" && (
        <div className="flex flex-col gap-3 w-full">
          <div className={`flex gap-2 border rounded-xl px-4 py-3 transition-colors
            ${saResult === "correct" ? "bg-green-500/10 border-green-500/40" :
              saResult === "wrong"   ? "bg-red-500/10   border-red-500/40"   :
                                      "bg-white/5      border-white/10 focus-within:border-cyan-500/50"}`}>
            <input
              value={saInput}
              onChange={e => setSaInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !saResult && checkShortAnswer()}
              disabled={!!saResult}
              placeholder="Type your answer here…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 outline-none"
            />
          </div>
          {!saResult && (
            <button onClick={checkShortAnswer} disabled={!saInput.trim()}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-sm font-semibold transition-all">
              Check Answer
            </button>
          )}
          {saResult && (
            <div className={`text-xs font-semibold ${saResult === "correct" ? "text-green-400" : "text-red-400"}`}>
              {saResult === "correct" ? "✅ Correct!" : `❌ Not quite. Model answer: ${(currentQ as SAQuestion).modelAnswer}`}
            </div>
          )}
        </div>
      )}

      {/* Explanation */}
      {showExplain && (
        <div className="w-full rounded-xl border px-4 py-4 text-sm leading-relaxed bg-violet-500/10 border-violet-500/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">
              {currentQ.type === "mcq"       ? (selectedMCQ === (currentQ as MCQQuestion).ans ? "✅" : "❌") :
               currentQ.type === "truefalse" ? (selectedTF  === (currentQ as TFQuestion).ans  ? "✅" : "❌") :
                                               (saResult === "correct"                         ? "✅" : "❌")}
            </span>
            <span className="font-bold text-sm text-violet-300">💡 Explanation</span>
          </div>
          <p className="text-gray-300 text-xs leading-relaxed">{currentQ.explain}</p>
        </div>
      )}

      {/* Next button */}
      {answered && (
        <button onClick={nextQuestion}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold transition-all">
          {idx + 1 >= questions.length ? "See Results 🏆" : <>Next Question <ChevronRight size={16} /></>}
        </button>
      )}
    </div>
  );

  // ── RESULT ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-5 p-4 sm:p-6 overflow-y-auto flex-1 w-full">
      {/* Score ring */}
      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 flex flex-col items-center justify-center shadow-lg"
        style={{
          borderColor: pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444",
          background:  pct >= 80 ? "rgba(34,197,94,0.1)" : pct >= 60 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
          boxShadow:   `0 0 30px ${pct >= 80 ? "rgba(34,197,94,0.2)" : pct >= 60 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`,
        }}>
        <div className="text-3xl sm:text-4xl font-extrabold" style={{ color: pct >= 80 ? "#4ade80" : pct >= 60 ? "#fbbf24" : "#f87171" }}>{pct}%</div>
        <div className="text-xs text-gray-400">score</div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-2 justify-center">
        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs">
          <Clock size={13} className="text-cyan-400" />
          <span className="text-gray-400">Time:</span>
          <span className="text-cyan-300 font-bold tabular-nums">{formatTime(sessionSecs)}</span>
        </div>
        {maxStreak >= 2 && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-500/10 border border-orange-500/25 rounded-xl text-xs font-bold text-orange-300">
            <Flame size={13} className="text-orange-400" /> Best streak: {maxStreak}
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs">
          <span className="text-red-400 font-bold">{wrongIdxs.length}</span>
          <span className="text-gray-400">to review</span>
        </div>
      </div>

      <div className="text-xl sm:text-2xl font-bold text-white text-center">
        {pct >= 80 ? "Excellent work! 🎉" : pct >= 60 ? "Good job! 👍" : "Keep studying! 💪"}
      </div>
      <div className="text-gray-400 text-sm">{score} of {questions.length} correct</div>

      {/* Tab switcher */}
      <div className="flex gap-2 w-full">
        {(["overview", "wrong", "all"] as const).map(tab => (
          <button key={tab} onClick={() => setResultTab(tab)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all
              ${resultTab === tab ? "bg-violet-600 border-violet-500 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"}`}>
            {tab === "overview" ? "Overview" : tab === "wrong" ? `❌ Wrong (${wrongIdxs.length})` : "📋 All Questions"}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {resultTab === "overview" && (
        <div className="w-full grid grid-cols-2 gap-3">
          {[
            { label: "Score",       value: `${score}/${questions.length}`, color: "text-white"      },
            { label: "Accuracy",    value: `${pct}%`,                      color: pct >= 60 ? "text-green-400" : "text-red-400" },
            { label: "Time",        value: formatTime(sessionSecs),         color: "text-cyan-300"   },
            { label: "Best Streak", value: `${maxStreak}x`,                color: "text-orange-300" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Wrong answers tab */}
      {resultTab === "wrong" && (
        <div className="w-full flex flex-col gap-3">
          {wrongIdxs.length === 0
            ? <div className="text-center py-8 text-gray-400 text-sm">🎉 No wrong answers — perfect score!</div>
            : wrongIdxs.map(wi => {
                const q = questions[wi];
                return (
                  <div key={wi} className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-4 text-left">
                    <div className="text-xs text-red-400 mb-1 font-semibold">Q{wi + 1}</div>
                    <div className="text-sm text-white font-medium mb-2">{q.q}</div>
                    {q.type === "mcq"       && <div className="text-xs text-green-400 mb-1">✓ {(q as MCQQuestion).opts[(q as MCQQuestion).ans]}</div>}
                    {q.type === "truefalse" && <div className="text-xs text-green-400 mb-1">✓ {(q as TFQuestion).ans ? "True" : "False"}</div>}
                    {q.type === "shortanswer" && <div className="text-xs text-green-400 mb-1">✓ {(q as SAQuestion).modelAnswer}</div>}
                    <div className="text-xs text-gray-400 leading-relaxed"><span className="text-violet-300 font-semibold">💡 </span>{q.explain}</div>
                  </div>
                );
              })
          }
        </div>
      )}

      {/* All questions tab */}
      {resultTab === "all" && (
        <div className="w-full flex flex-col gap-3">
          {questions.map((q, i) => {
            const wasWrong = wrongIdxs.includes(i);
            return (
              <div key={i} className={`rounded-xl px-4 py-4 text-left border ${wasWrong ? "bg-red-500/5 border-red-500/20" : "bg-green-500/5 border-green-500/15"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 font-semibold">Q{i + 1}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border text-gray-500 border-white/10 bg-white/5">
                    {q.type === "mcq" ? "MCQ" : q.type === "truefalse" ? "T/F" : "SA"}
                  </span>
                  <span className="ml-auto text-xs">{wasWrong ? "❌" : "✅"}</span>
                </div>
                <div className="text-sm text-white font-medium mb-2">{q.q}</div>
                {q.type === "mcq"         && <div className="text-xs text-green-400 mb-1">✓ {(q as MCQQuestion).opts[(q as MCQQuestion).ans]}</div>}
                {q.type === "truefalse"   && <div className="text-xs text-green-400 mb-1">✓ {(q as TFQuestion).ans ? "True" : "False"}</div>}
                {q.type === "shortanswer" && <div className="text-xs text-green-400 mb-1">✓ {(q as SAQuestion).modelAnswer}</div>}
                <div className="text-xs text-gray-400 leading-relaxed"><span className="text-violet-300 font-semibold">💡 </span>{q.explain}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="w-full flex flex-col gap-3 mt-1">
        <button onClick={startQuiz} className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all">
          🔄 Retry Same Topic
        </button>
        <button onClick={reset} className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-sm font-medium transition-all">
          New Quiz
        </button>
      </div>
    </div>
  );
}