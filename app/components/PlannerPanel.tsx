"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2, CalendarDays, Plus, CheckSquare, Square,
  Trash2, CheckCheck, ChevronLeft, Pencil, Sparkles, Flag, Calendar,
} from "lucide-react";

type Task    = { text: string; done: boolean; dissolving?: boolean; priority?: boolean };
type Subject = { name: string; color: string; tasks: Task[]; dissolving?: boolean; dueDate?: string };
type Plan    = { id: string; name: string; subjects: Subject[]; dissolving?: boolean; createdAt?: string };

const DISSOLVE_CSS = `
@keyframes pixelDissolve {
  0%   { opacity:1; filter:blur(0px) brightness(1); transform:scale(1); }
  30%  { opacity:0.8; filter:blur(1px) brightness(1.4); transform:scale(1.01); }
  60%  { opacity:0.4; filter:blur(3px) brightness(0.8); transform:scale(0.98); }
  100% { opacity:0; filter:blur(8px) brightness(0.2); transform:scale(0.94); }
}
.dissolve-out { animation:pixelDissolve 0.55s ease-in forwards; pointer-events:none; }
@keyframes pixelDissolveRow {
  0%   { opacity:1; filter:blur(0px) brightness(1); transform:scaleY(1) translateX(0); }
  25%  { filter:blur(0.5px) brightness(1.5); transform:scaleY(1) translateX(2px); }
  60%  { opacity:0.5; filter:blur(2px) brightness(0.6); transform:scaleY(0.95) translateX(-1px); }
  100% { opacity:0; filter:blur(6px) brightness(0); transform:scaleY(0.7) translateX(4px); }
}
.dissolve-row { animation:pixelDissolveRow 0.45s ease-in forwards; pointer-events:none; }
@keyframes planDissolve {
  0%   { opacity:1; filter:blur(0px) brightness(1) saturate(1); transform:scale(1); }
  20%  { filter:blur(0px) brightness(2) saturate(2); transform:scale(1.005); }
  50%  { opacity:0.6; filter:blur(2px) brightness(0.8) saturate(0.5); transform:scale(0.99); }
  100% { opacity:0; filter:blur(12px) brightness(0) saturate(0); transform:scale(0.93); }
}
.dissolve-plan { animation:planDissolve 0.7s ease-in forwards; pointer-events:none; }
`;

const COLORS = ["#6c63ff","#10b981","#f59e0b","#ec4899","#22d3ee","#f97316","#ef4444","#8b5cf6"];
function uid() { return Math.random().toString(36).slice(2, 10); }
function today() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function isOverdue(iso?: string) {
  if (!iso) return false;
  return new Date(iso + "T00:00:00") < new Date(new Date().toDateString());
}

export default function PlannerPanel() {
  const [plans,        setPlans]        = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string>("");
  const [expanded,     setExpanded]     = useState<Set<number>>(new Set());
  const [goal,         setGoal]         = useState("");
  const [loading,      setLoading]      = useState(false);
  const [mobileView,   setMobileView]   = useState<"list" | "detail">("list");
  const [showAI,       setShowAI]       = useState(false);

  // Inline add-task state: { subjectIndex, value }
  const [addingTask, setAddingTask]     = useState<{ si: number; value: string } | null>(null);
  const addInputRef                     = useRef<HTMLInputElement>(null);
  const styleInjected                   = useRef(false);

  useEffect(() => {
    if (!styleInjected.current) {
      const tag = document.createElement("style");
      tag.textContent = DISSOLVE_CSS;
      document.head.appendChild(tag);
      styleInjected.current = true;
    }
    const saved = localStorage.getItem("studyai-plans-v2");
    if (saved) {
      const parsed: Plan[] = JSON.parse(saved);
      setPlans(parsed);
      if (parsed.length > 0) setActivePlanId(parsed[0].id);
    }
  }, []);

  useEffect(() => {
    if (addingTask !== null) addInputRef.current?.focus();
  }, [addingTask]);

  function persist(updated: Plan[]) {
    setPlans(updated);
    localStorage.setItem("studyai-plans-v2", JSON.stringify(
      updated.map(p => ({ ...p, dissolving: false, subjects: p.subjects.map(s => ({ ...s, dissolving: false, tasks: s.tasks.map(t => ({ ...t, dissolving: false })) })) }))
    ));
  }

  const activePlan = plans.find(p => p.id === activePlanId) ?? null;

  // ── Plan actions ──────────────────────────────────────────────
  function createPlan() {
    const name = prompt("Plan name:");
    if (!name?.trim()) return;
    const plan: Plan = { id: uid(), name: name.trim(), subjects: [], createdAt: today() };
    const updated = [...plans, plan];
    persist(updated);
    setActivePlanId(plan.id);
    setExpanded(new Set());
    setMobileView("detail");
  }

  function deletePlan(id: string) {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, dissolving: true } : p));
    setTimeout(() => {
      setPlans(prev => {
        const cleaned = prev.filter(p => p.id !== id);
        localStorage.setItem("studyai-plans-v2", JSON.stringify(cleaned));
        setActivePlanId(cleaned[0]?.id ?? "");
        if (!cleaned[0]) setMobileView("list");
        return cleaned;
      });
    }, 720);
  }

  function completePlan(id: string) {
    setPlans(prev => prev.map(p =>
      p.id !== id ? p : { ...p, dissolving: true, subjects: p.subjects.map(s => ({ ...s, tasks: s.tasks.map(t => ({ ...t, done: true })) })) }
    ));
    setTimeout(() => {
      setPlans(prev => {
        const cleaned = prev.filter(p => p.id !== id);
        localStorage.setItem("studyai-plans-v2", JSON.stringify(cleaned));
        setActivePlanId(cleaned[0]?.id ?? "");
        if (!cleaned[0]) setMobileView("list");
        return cleaned;
      });
    }, 720);
  }

  function renamePlan(id: string) {
    const name = prompt("Rename plan:");
    if (!name?.trim()) return;
    persist(plans.map(p => p.id === id ? { ...p, name: name.trim() } : p));
  }

  function selectPlan(id: string) {
    setActivePlanId(id);
    setExpanded(new Set());
    setAddingTask(null);
    setMobileView("detail");
  }

  // ── Subject actions ───────────────────────────────────────────
  function updateActivePlan(subjects: Subject[]) {
    persist(plans.map(p => p.id === activePlanId ? { ...p, subjects } : p));
  }

  function addSubject() {
    if (!activePlan) return;
    const name = prompt("Subject name:");
    if (!name?.trim()) return;
    const newSubjects: Subject[] = [...activePlan.subjects, {
      name: name.trim(),
      color: COLORS[activePlan.subjects.length % COLORS.length],
      tasks: [],
    }];
    updateActivePlan(newSubjects);
    setExpanded(prev => new Set([...prev, newSubjects.length - 1]));
  }

  function setSubjectDueDate(si: number, date: string) {
    if (!activePlan) return;
    updateActivePlan(activePlan.subjects.map((s, i) => i === si ? { ...s, dueDate: date } : s));
  }

  function deleteSubject(si: number) {
    if (!activePlan) return;
    const withDissolve = activePlan.subjects.map((s, i) => i === si ? { ...s, dissolving: true } : s);
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, subjects: withDissolve } : p));
    setTimeout(() => {
      updateActivePlan(withDissolve.filter((_, i) => i !== si));
      setExpanded(prev => {
        const next = new Set<number>();
        prev.forEach(idx => { if (idx < si) next.add(idx); else if (idx > si) next.add(idx - 1); });
        return next;
      });
    }, 580);
  }

  // ── Task actions ──────────────────────────────────────────────
  function toggleTask(si: number, ti: number) {
    if (!activePlan) return;
    const task = activePlan.subjects[si].tasks[ti];
    if (task.dissolving) return;
    if (!task.done) {
      const withDissolve = activePlan.subjects.map((s, i) =>
        i === si ? { ...s, tasks: s.tasks.map((t, j) => j === ti ? { ...t, done: true, dissolving: true } : t) } : s
      );
      setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, subjects: withDissolve } : p));
      setTimeout(() => {
        updateActivePlan(withDissolve.map((s, i) =>
          i === si ? { ...s, tasks: s.tasks.filter((_, j) => j !== ti) } : s
        ));
      }, 480);
    } else {
      updateActivePlan(activePlan.subjects.map((s, i) =>
        i === si ? { ...s, tasks: s.tasks.map((t, j) => j === ti ? { ...t, done: false } : t) } : s
      ));
    }
  }

  function togglePriority(si: number, ti: number) {
    if (!activePlan) return;
    updateActivePlan(activePlan.subjects.map((s, i) =>
      i === si ? { ...s, tasks: s.tasks.map((t, j) => j === ti ? { ...t, priority: !t.priority } : t) } : s
    ));
  }

  function deleteTask(si: number, ti: number) {
    if (!activePlan) return;
    const withDissolve = activePlan.subjects.map((s, i) =>
      i === si ? { ...s, tasks: s.tasks.map((t, j) => j === ti ? { ...t, dissolving: true } : t) } : s
    );
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, subjects: withDissolve } : p));
    setTimeout(() => {
      updateActivePlan(withDissolve.map((s, i) =>
        i === si ? { ...s, tasks: s.tasks.filter((_, j) => j !== ti) } : s
      ));
    }, 480);
  }

  function commitAddTask(si: number) {
    if (!activePlan || !addingTask || !addingTask.value.trim()) {
      setAddingTask(null);
      return;
    }
    updateActivePlan(activePlan.subjects.map((s, i) =>
      i === si ? { ...s, tasks: [...s.tasks, { text: addingTask.value.trim(), done: false, priority: false }] } : s
    ));
    setAddingTask({ si, value: "" });
    setTimeout(() => addInputRef.current?.focus(), 50);
  }

  function toggleExpanded(i: number) {
    setExpanded(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  // ── AI Plan Generator ─────────────────────────────────────────
  async function generatePlan() {
    if (!goal.trim()) return;
    const name = prompt("Name this plan:", goal.trim().slice(0, 40));
    if (!name?.trim()) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "studyplan", payload: { goal } }),
      });
      const data = await res.json();
      if (data.data) {
        const subjects: Subject[] = data.data.map((s: { name: string; color: string; tasks: string[] }) => ({
          ...s, tasks: s.tasks.map((t: string) => ({ text: t, done: false, priority: false })),
        }));
        const plan: Plan = { id: uid(), name: name.trim(), subjects, createdAt: today() };
        const updated = [...plans, plan];
        persist(updated);
        setActivePlanId(plan.id);
        setExpanded(new Set(subjects.map((_, i) => i)));
        setGoal("");
        setShowAI(false);
        setMobileView("detail");
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  // ── Stats ─────────────────────────────────────────────────────
  const subjects   = activePlan?.subjects ?? [];
  const totalTasks = subjects.reduce((a, s) => a + s.tasks.length, 0);
  const doneTasks  = subjects.reduce((a, s) => a + s.tasks.filter(t => t.done).length, 0);
  const overallPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const priorityCount = subjects.reduce((a, s) => a + s.tasks.filter(t => t.priority && !t.done).length, 0);

  // ── AI Generator card ─────────────────────────────────────────
  const AIGenerator = () => (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={13} className="text-violet-400" />
        <span className="font-semibold text-sm text-white">AI Study Plan Generator</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">Describe your goal and AI builds a complete plan with subjects and tasks.</p>
      <div className="flex flex-col gap-2">
        <input
          value={goal}
          onChange={e => setGoal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && generatePlan()}
          placeholder="e.g. Prepare for calculus exam in 7 days"
          className="w-full bg-white/5 border border-white/10 text-white placeholder:text-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500/50 transition-colors"
        />
        <button onClick={generatePlan} disabled={loading || !goal.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-sm font-semibold transition-all">
          {loading ? <Loader2 size={14} className="animate-spin" /> : "✦"}
          {loading ? "Generating…" : "Generate Plan"}
        </button>
      </div>
    </div>
  );

  // ── Plan detail ───────────────────────────────────────────────
  const PlanDetailContent = () => (
    <div className="flex flex-col gap-4 p-4 sm:p-6 overflow-y-auto flex-1">

      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={() => setMobileView("list")}
          className="sm:hidden shrink-0 p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 active:scale-95 transition-all">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white truncate">{activePlan?.name}</h2>
          <p className="text-xs text-gray-500">
            {totalTasks} tasks · {doneTasks} done
            {priorityCount > 0 && <span className="ml-2 text-red-400">· {priorityCount} priority</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={addSubject}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-all">
            <Plus size={12} /> Subject
          </button>
          <button onClick={() => renamePlan(activePlanId)}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl transition-all" title="Rename">
            <Pencil size={13} />
          </button>
          <button onClick={() => completePlan(activePlanId)}
            className="p-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 text-green-400 rounded-xl transition-all" title="Mark complete">
            <CheckCheck size={13} />
          </button>
          <button onClick={() => deletePlan(activePlanId)}
            className="p-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-gray-500 hover:text-red-400 rounded-xl transition-all" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Progress */}
      {totalTasks > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-white">Overall Progress</span>
            <span className="text-sm font-bold text-violet-300">{overallPct}%</span>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${overallPct}%`, background: "linear-gradient(90deg,#6c63ff,#a78bfa,#22d3ee)" }} />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-500">{doneTasks} of {totalTasks} completed</span>
            {overallPct === 100 && <span className="text-xs text-emerald-400 font-semibold">🎉 All done!</span>}
          </div>
        </div>
      )}

      {subjects.length === 0 && (
        <div className="text-center py-8 text-gray-600 text-sm">No subjects yet — tap "+ Subject" to add one.</div>
      )}

      {/* Subjects */}
      {subjects.map((subj, si) => {
        const done   = subj.tasks.filter(t => t.done && !t.dissolving).length;
        const total  = subj.tasks.filter(t => !t.dissolving).length;
        const pct    = total ? Math.round((done / total) * 100) : 0;
        const isOpen = expanded.has(si);
        const overdue = isOverdue(subj.dueDate);
        const priorityTasks = subj.tasks.filter(t => t.priority && !t.done && !t.dissolving);

        return (
          <div key={si} className={`bg-white/5 border border-white/10 rounded-2xl overflow-hidden ${subj.dissolving ? "dissolve-out" : ""}`}>
            {/* Subject header */}
            <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/3 transition-colors"
              onClick={() => toggleExpanded(si)}>
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: subj.color }} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-white truncate">{subj.name}</div>
                {subj.dueDate && (
                  <div className={`flex items-center gap-1 text-[10px] mt-0.5 ${overdue ? "text-red-400" : "text-gray-500"}`}>
                    <Calendar size={9} /> Due {fmtDate(subj.dueDate)} {overdue && "· Overdue"}
                  </div>
                )}
              </div>
              {priorityTasks.length > 0 && (
                <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                  {priorityTasks.length} ⚑
                </span>
              )}
              <div className="text-xs text-gray-500 shrink-0">{done}/{total}</div>
              <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: subj.color }} />
              </div>
              {/* Due date picker */}
              <div onClick={e => e.stopPropagation()} title="Set due date" className="shrink-0">
                <label className="cursor-pointer p-1.5 rounded-lg text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all block">
                  <Calendar size={12} />
                  <input type="date" value={subj.dueDate || ""} onChange={e => setSubjectDueDate(si, e.target.value)}
                    className="absolute opacity-0 w-0 h-0 pointer-events-none" />
                </label>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteSubject(si); }}
                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                <Trash2 size={12} />
              </button>
              <span className="text-gray-500 text-xs shrink-0">{isOpen ? "▲" : "▼"}</span>
            </div>

            {/* Tasks */}
            {isOpen && (
              <div className="px-4 pb-4 flex flex-col gap-1.5 border-t border-white/5 pt-3">
                {subj.tasks.length === 0 && (
                  <p className="text-xs text-gray-600 py-2 text-center">No tasks yet</p>
                )}
                {/* Priority tasks first */}
                {[...subj.tasks]
                  .map((t, origIdx) => ({ ...t, origIdx }))
                  .sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0))
                  .map(({ origIdx, ...task }) => (
                    <div key={origIdx}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border transition-all
                        ${task.dissolving ? "dissolve-row" : ""}
                        ${task.priority && !task.done ? "bg-red-500/5 border-red-500/15" : "bg-white/2 border-white/5"}`}>
                      <div className="shrink-0 cursor-pointer active:scale-90 transition-transform"
                        onClick={() => toggleTask(si, origIdx)}>
                        {task.done
                          ? <CheckSquare size={16} style={{ color: subj.color }} />
                          : <Square size={16} className="text-gray-500" />}
                      </div>
                      <span
                        className={`text-sm flex-1 cursor-pointer select-none leading-snug transition-all ${task.done ? "line-through text-gray-600" : "text-gray-300"}`}
                        onClick={() => toggleTask(si, origIdx)}>
                        {task.text}
                      </span>
                      {/* Priority flag */}
                      <button onClick={() => togglePriority(si, origIdx)} title="Toggle priority"
                        className={`shrink-0 p-1.5 rounded-lg transition-all ${task.priority ? "text-red-400 bg-red-500/10" : "text-gray-600 hover:text-red-400 hover:bg-red-500/10"}`}>
                        <Flag size={11} />
                      </button>
                      <button onClick={() => deleteTask(si, origIdx)}
                        className="shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}

                {/* Inline add task */}
                {addingTask?.si === si ? (
                  <div className="flex items-center gap-2 mt-1 rounded-xl px-3 py-2.5 bg-violet-500/8 border border-violet-500/25">
                    <Plus size={14} className="text-violet-400 shrink-0" />
                    <input
                      ref={addInputRef}
                      value={addingTask.value}
                      onChange={e => setAddingTask({ si, value: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === "Enter") commitAddTask(si);
                        if (e.key === "Escape") setAddingTask(null);
                      }}
                      placeholder="Task name… (Enter to add, Esc to cancel)"
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 outline-none"
                    />
                    <button onClick={() => commitAddTask(si)}
                      className="shrink-0 px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold transition-all">
                      Add
                    </button>
                    <button onClick={() => setAddingTask(null)}
                      className="shrink-0 text-gray-500 hover:text-white text-xs px-1">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingTask({ si, value: "" })}
                    className="mt-1 w-full text-center text-xs text-gray-600 hover:text-violet-400 border border-dashed border-white/10 hover:border-violet-500/40 rounded-xl px-3 py-2.5 transition-all active:scale-[0.98]">
                    + Add task
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      <AIGenerator />
    </div>
  );

  // ── Plan list ─────────────────────────────────────────────────
  const PlanListContent = () => (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-pink-500/20 border border-pink-500/30 shrink-0">
            <CalendarDays size={18} className="text-pink-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Study Planner</h2>
            <p className="text-xs text-gray-400">Track subjects and tasks</p>
          </div>
        </div>
        <button onClick={createPlan}
          className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition-all active:scale-95">
          <Plus size={13} /> New Plan
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 flex flex-col gap-3">
        {plans.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-12">
            <div className="text-5xl mb-2">📅</div>
            <div className="text-white font-semibold">No plans yet</div>
            <div className="text-gray-400 text-sm max-w-xs">Create a plan or use the AI generator below.</div>
          </div>
        )}

        {plans.map(plan => {
          const planTotal = plan.subjects.reduce((a, s) => a + s.tasks.length, 0);
          const planDone  = plan.subjects.reduce((a, s) => a + s.tasks.filter(t => t.done).length, 0);
          const planPct   = planTotal ? Math.round((planDone / planTotal) * 100) : 0;
          const isActive  = activePlanId === plan.id;
          const hasOverdue = plan.subjects.some(s => isOverdue(s.dueDate) && s.tasks.some(t => !t.done));

          return (
            <div key={plan.id} onClick={() => { if (!plan.dissolving) selectPlan(plan.id); }}
              className={`group rounded-2xl border px-4 py-4 cursor-pointer transition-all active:scale-[0.99]
                ${plan.dissolving ? "dissolve-plan" : ""}
                ${isActive ? "bg-violet-600/20 border-violet-500/40" : "bg-white/5 border-white/10 hover:border-white/20"}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: plan.subjects[0]?.color ?? "#6c63ff" }} />
                <span className="font-semibold text-sm text-white flex-1 truncate">{plan.name}</span>
                {hasOverdue && <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full shrink-0">Overdue</span>}
                <div className="flex gap-1 shrink-0">
                  <button onClick={e => { e.stopPropagation(); renamePlan(plan.id); }}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/10 transition-all">
                    <Pencil size={11} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deletePlan(plan.id); }}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${planPct}%`, background: plan.subjects[0]?.color ?? "#6c63ff" }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{planDone}/{planTotal} tasks · {plan.subjects.length} subjects</span>
                <span className={`text-xs font-semibold ${isActive ? "text-violet-400" : "text-gray-600"}`}>{planPct}%</span>
              </div>
            </div>
          );
        })}

        <AIGenerator />
      </div>
    </div>
  );

  return (
    <>
      {/* MOBILE */}
      <div className="flex sm:hidden flex-1 overflow-hidden">
        {mobileView === "list" && <PlanListContent />}
        {mobileView === "detail" && (
          activePlan ? <PlanDetailContent /> : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="text-5xl mb-2">📅</div>
              <div className="text-white font-semibold">No plan selected</div>
              <button onClick={() => setMobileView("list")} className="text-sm text-violet-400 underline">Back to plans</button>
            </div>
          )
        )}
      </div>

      {/* DESKTOP */}
      <div className="hidden sm:flex flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 flex flex-col border-r border-white/8 bg-black/20 backdrop-blur-xl overflow-hidden">
          <div className="px-4 py-4 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-pink-500/20 border border-pink-500/30">
                <CalendarDays size={14} className="text-pink-400" />
              </div>
              <span className="text-xs font-bold text-white">My Plans</span>
            </div>
            <button onClick={createPlan}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all">
              <Plus size={13} /> New Plan
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
            {plans.length === 0 && (
              <p className="text-xs text-gray-600 text-center px-3 py-6 leading-relaxed">No plans yet. Create one or use the AI generator.</p>
            )}
            {plans.map(plan => {
              const hasOverdue = plan.subjects.some(s => isOverdue(s.dueDate) && s.tasks.some(t => !t.done));
              return (
                <div key={plan.id}
                  className={`group relative rounded-xl px-3 py-3 cursor-pointer transition-all
                    ${plan.dissolving ? "dissolve-plan" : ""}
                    ${activePlanId === plan.id ? "bg-violet-600/30 border border-violet-500/40 text-white" : "hover:bg-white/5 text-gray-400 hover:text-gray-200 border border-transparent"}`}
                  onClick={() => { if (!plan.dissolving) selectPlan(plan.id); }}>
                  <div className="flex items-center gap-2 pr-12">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: plan.subjects[0]?.color ?? "#6c63ff" }} />
                    <span className="text-sm font-medium truncate">{plan.name}</span>
                    {hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" title="Has overdue subjects" />}
                  </div>
                  <span className="text-[10px] text-gray-600 mt-0.5 block pl-4">
                    {plan.subjects.reduce((a, s) => a + s.tasks.length, 0)} tasks
                  </span>
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                    <button onClick={e => { e.stopPropagation(); renamePlan(plan.id); }}
                      className="p-1 rounded text-gray-600 hover:text-gray-300 text-[11px] leading-none">✎</button>
                    <button onClick={e => { e.stopPropagation(); deletePlan(plan.id); }}
                      className="p-1 rounded text-gray-600 hover:text-red-400"><Trash2 size={11} /></button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-white/8 shrink-0">
            <button onClick={() => setShowAI(v => !v)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-semibold transition-all mb-2">
              <Sparkles size={12} /> AI Generator
            </button>
            {showAI && (
              <div className="flex flex-col gap-2">
                <input value={goal} onChange={e => setGoal(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && generatePlan()}
                  placeholder="e.g. Calculus exam in 7 days"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-gray-600 rounded-xl px-3 py-2 text-xs outline-none focus:border-violet-500/50 transition-colors" />
                <button onClick={generatePlan} disabled={loading || !goal.trim()}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-xs font-semibold transition-all">
                  {loading ? <Loader2 size={12} className="animate-spin" /> : "✦"}
                  {loading ? "Generating…" : "Generate"}
                </button>
              </div>
            )}
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          {activePlan ? <PlanDetailContent /> : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="text-5xl mb-2">📅</div>
              <div className="text-white font-semibold text-lg">No plan selected</div>
              <div className="text-gray-400 text-sm max-w-xs">Pick a plan from the sidebar or create a new one.</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}