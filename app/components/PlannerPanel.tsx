"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CalendarDays, Plus, CheckSquare, Square, Trash2, CheckCheck } from "lucide-react";

type Task    = { text: string; done: boolean; dissolving?: boolean };
type Subject = { name: string; color: string; tasks: Task[]; dissolving?: boolean };
type Plan    = { id: string; name: string; subjects: Subject[]; dissolving?: boolean };

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

function uid() { return Math.random().toString(36).slice(2,10); }

export default function PlannerPanel() {
  const [plans, setPlans]               = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string>("");
  const [expanded, setExpanded]         = useState<Set<number>>(new Set());
  const [goal, setGoal]                 = useState("");
  const [loading, setLoading]           = useState(false);
  const styleInjected                   = useRef(false);

  useEffect(() => {
    if (!styleInjected.current) {
      const tag = document.createElement("style");
      tag.textContent = DISSOLVE_CSS;
      document.head.appendChild(tag);
      styleInjected.current = true;
    }
    const saved = localStorage.getItem("studyai-plans-v1");
    if (saved) {
      const parsed: Plan[] = JSON.parse(saved);
      setPlans(parsed);
      if (parsed.length > 0) setActivePlanId(parsed[0].id);
    }
  }, []);

  function persist(updated: Plan[]) {
    setPlans(updated);
    localStorage.setItem("studyai-plans-v1", JSON.stringify(updated.map(p => ({ ...p, dissolving: false }))));
  }

  const activePlan = plans.find(p => p.id === activePlanId) ?? null;

  // ── Plan actions ──────────────────────────────────────────────
  function createPlan() {
    const name = prompt("Plan name:");
    if (!name?.trim()) return;
    const plan: Plan = { id: uid(), name: name.trim(), subjects: [] };
    const updated = [...plans, plan];
    persist(updated);
    setActivePlanId(plan.id);
    setExpanded(new Set());
  }

  function deletePlan(id: string) {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, dissolving: true } : p));
    setTimeout(() => {
      setPlans(prev => {
        const cleaned = prev.filter(p => p.id !== id);
        localStorage.setItem("studyai-plans-v1", JSON.stringify(cleaned));
        if (activePlanId === id) setActivePlanId(cleaned[0]?.id ?? "");
        return cleaned;
      });
    }, 720);
  }

  function completePlan(id: string) {
    setPlans(prev => prev.map(p =>
      p.id !== id ? p : {
        ...p,
        dissolving: true,
        subjects: p.subjects.map(s => ({ ...s, tasks: s.tasks.map(t => ({ ...t, done: true })) }))
      }
    ));
    setTimeout(() => {
      setPlans(prev => {
        const cleaned = prev.filter(p => p.id !== id);
        localStorage.setItem("studyai-plans-v1", JSON.stringify(cleaned));
        if (activePlanId === id) setActivePlanId(cleaned[0]?.id ?? "");
        return cleaned;
      });
    }, 720);
  }

  function renamePlan(id: string) {
    const name = prompt("Rename plan:");
    if (!name?.trim()) return;
    persist(plans.map(p => p.id === id ? { ...p, name: name.trim() } : p));
  }

  // ── Subject actions ───────────────────────────────────────────
  function updateActivePlan(subjects: Subject[]) {
    persist(plans.map(p => p.id === activePlanId ? { ...p, subjects } : p));
  }

  function addSubject() {
    if (!activePlan) return;
    const name = prompt("Subject name:");
    if (!name?.trim()) return;
    const newSubjects = [...activePlan.subjects, {
      name: name.trim(),
      color: COLORS[activePlan.subjects.length % COLORS.length],
      tasks: [],
    }];
    updateActivePlan(newSubjects);
    setExpanded(prev => new Set([...prev, newSubjects.length - 1]));
  }

  function deleteSubject(si: number) {
    if (!activePlan) return;
    const withDissolve = activePlan.subjects.map((s, i) => i === si ? { ...s, dissolving: true } : s);
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, subjects: withDissolve } : p));
    setTimeout(() => {
      const cleaned = withDissolve.filter((_, i) => i !== si);
      updateActivePlan(cleaned);
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
        const cleaned = withDissolve.map((s, i) =>
          i === si ? { ...s, tasks: s.tasks.filter((_, j) => j !== ti) } : s
        );
        updateActivePlan(cleaned);
      }, 480);
    } else {
      const updated = activePlan.subjects.map((s, i) =>
        i === si ? { ...s, tasks: s.tasks.map((t, j) => j === ti ? { ...t, done: false } : t) } : s
      );
      updateActivePlan(updated);
    }
  }

  function deleteTask(si: number, ti: number) {
    if (!activePlan) return;
    const withDissolve = activePlan.subjects.map((s, i) =>
      i === si ? { ...s, tasks: s.tasks.map((t, j) => j === ti ? { ...t, dissolving: true } : t) } : s
    );
    setPlans(prev => prev.map(p => p.id === activePlanId ? { ...p, subjects: withDissolve } : p));
    setTimeout(() => {
      const cleaned = withDissolve.map((s, i) =>
        i === si ? { ...s, tasks: s.tasks.filter((_, j) => j !== ti) } : s
      );
      updateActivePlan(cleaned);
    }, 480);
  }

  function addTask(si: number) {
    if (!activePlan) return;
    const text = prompt("New task:");
    if (!text?.trim()) return;
    const updated = activePlan.subjects.map((s, i) =>
      i === si ? { ...s, tasks: [...s.tasks, { text: text.trim(), done: false }] } : s
    );
    updateActivePlan(updated);
  }

  function toggleExpanded(i: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  // ── AI Plan Generator ─────────────────────────────────────────
  async function generatePlan() {
    if (!goal.trim()) return;
    const name = prompt("Name this plan:", goal.trim().slice(0, 40));
    if (!name?.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "studyplan", payload: { goal } }),
      });
      const data = await res.json();
      if (data.data) {
        const subjects: Subject[] = data.data.map(
          (s: { name: string; color: string; tasks: string[] }) => ({
            ...s,
            tasks: s.tasks.map((t: string) => ({ text: t, done: false })),
          })
        );
        const plan: Plan = { id: uid(), name: name.trim(), subjects };
        const updated = [...plans, plan];
        persist(updated);
        setActivePlanId(plan.id);
        setExpanded(new Set(subjects.map((_, i) => i)));
        setGoal("");
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  // ── Stats ─────────────────────────────────────────────────────
  const subjects   = activePlan?.subjects ?? [];
  const totalTasks = subjects.reduce((a, s) => a + s.tasks.length, 0);
  const doneTasks  = subjects.reduce((a, s) => a + s.tasks.filter(t => t.done).length, 0);
  const overallPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-52 shrink-0 flex flex-col border-r border-white/8 bg-black/20 backdrop-blur-xl overflow-hidden">
        <div className="px-4 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-pink-500/20 border border-pink-500/30">
              <CalendarDays size={14} className="text-pink-400" />
            </div>
            <span className="text-xs font-bold text-white">My Plans</span>
          </div>
          <button
            onClick={createPlan}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition-all"
          >
            <Plus size={12} /> New Plan
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
          {plans.length === 0 && (
            <p className="text-[11px] text-gray-600 text-center px-3 py-6 leading-relaxed">
              No plans yet. Create one or use the AI generator.
            </p>
          )}
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`group relative rounded-xl px-3 py-2.5 cursor-pointer transition-all
                ${plan.dissolving ? "dissolve-plan" : ""}
                ${activePlanId === plan.id
                  ? "bg-violet-600/30 border border-violet-500/40 text-white"
                  : "hover:bg-white/5 text-gray-400 hover:text-gray-200 border border-transparent"
                }`}
              onClick={() => { if (!plan.dissolving) { setActivePlanId(plan.id); setExpanded(new Set()); } }}
            >
              <div className="flex items-center gap-2 pr-10">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: plan.subjects[0]?.color ?? "#6c63ff" }}
                />
                <span className="text-xs font-medium truncate">{plan.name}</span>
              </div>
              <span className="text-[10px] text-gray-600 mt-0.5 block pl-4">
                {plan.subjects.reduce((a, s) => a + s.tasks.length, 0)} tasks
              </span>

              {/* Hover actions */}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                <button
                  onClick={e => { e.stopPropagation(); renamePlan(plan.id); }}
                  className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors text-[11px] leading-none"
                  title="Rename"
                >✎</button>
                <button
                  onClick={e => { e.stopPropagation(); deletePlan(plan.id); }}
                  className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 flex-col gap-5 p-6 overflow-y-auto">

        {/* No plan selected */}
        {!activePlan && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-20">
            <div className="text-5xl mb-2">📅</div>
            <div className="text-white font-semibold text-lg">No plan selected</div>
            <div className="text-gray-400 text-sm max-w-xs">
              Create a new plan from the sidebar, or generate one with AI below.
            </div>
          </div>
        )}

        {activePlan && (
          <>
            {/* Plan header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{activePlan.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {totalTasks} tasks · {doneTasks} completed
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={addSubject}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-all"
                >
                  <Plus size={12} /> Subject
                </button>
                <button
                  onClick={() => completePlan(activePlanId)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 text-green-400 rounded-xl text-xs font-semibold transition-all"
                  title="Mark complete and remove"
                >
                  <CheckCheck size={13} /> Complete
                </button>
                <button
                  onClick={() => deletePlan(activePlanId)}
                  className="p-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-gray-500 hover:text-red-400 rounded-xl transition-all"
                  title="Delete plan"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Overall progress */}
            {totalTasks > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-white">Overall Progress</span>
                  <span className="text-sm font-bold text-violet-300">{overallPct}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${overallPct}%`, background: "linear-gradient(90deg,#6c63ff,#a78bfa)" }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {doneTasks} of {totalTasks} tasks completed
                </div>
              </div>
            )}

            {/* Subjects */}
            <div className="flex flex-col gap-3">
              {subjects.length === 0 && (
                <div className="text-center py-10 text-gray-600 text-sm">
                  No subjects yet. Add one above or generate a plan with AI below.
                </div>
              )}
              {subjects.map((subj, si) => {
                const done  = subj.tasks.filter(t => t.done && !t.dissolving).length;
                const total = subj.tasks.length;
                const pct   = total ? Math.round((done / total) * 100) : 0;
                const isOpen = expanded.has(si);

                return (
                  <div
                    key={si}
                    className={`bg-white/5 border border-white/10 rounded-2xl overflow-hidden ${subj.dissolving ? "dissolve-out" : ""}`}
                  >
                    <div
                      className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-white/5 transition-colors group"
                      onClick={() => toggleExpanded(si)}
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: subj.color }} />
                      <div className="flex-1 font-semibold text-sm text-white">{subj.name}</div>
                      <div className="text-xs text-gray-500 mr-2">{done}/{total}</div>
                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: subj.color }}
                        />
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteSubject(si); }}
                        className="ml-2 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete subject"
                      >
                        <Trash2 size={13} />
                      </button>
                      <span className="text-gray-500 text-xs ml-1">{isOpen ? "▲" : "▼"}</span>
                    </div>

                    {isOpen && (
                      <div className="px-5 pb-4 flex flex-col gap-1.5 border-t border-white/5 pt-3">
                        {subj.tasks.map((task, ti) => (
                          <div
                            key={ti}
                            className={`flex items-center gap-3 group/task rounded-xl px-2 py-1.5 hover:bg-white/5 transition-all ${task.dissolving ? "dissolve-row" : ""}`}
                          >
                            <div
                              className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 cursor-pointer"
                              onClick={() => toggleTask(si, ti)}
                            >
                              {task.done
                                ? <CheckSquare size={15} style={{ color: subj.color }} />
                                : <Square size={15} />
                              }
                            </div>
                            <span
                              className={`text-sm flex-1 cursor-pointer select-none transition-all ${task.done ? "line-through text-gray-600" : "text-gray-300"}`}
                              onClick={() => toggleTask(si, ti)}
                            >
                              {task.text}
                            </span>
                            <button
                              onClick={() => deleteTask(si, ti)}
                              className="opacity-0 group-hover/task:opacity-100 p-1 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addTask(si)}
                          className="mt-1 text-left text-xs text-gray-600 hover:text-gray-400 border border-dashed border-white/10 hover:border-white/20 rounded-lg px-3 py-2 transition-all"
                        >
                          + Add task
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* AI Plan Generator */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mt-auto shrink-0">
          <div className="font-semibold text-sm text-white mb-1">✦ AI Study Plan Generator</div>
          <p className="text-xs text-gray-500 mb-3">
            Describe your goal and AI will build a complete plan with subjects and tasks.
          </p>
          <div className="flex gap-3">
            <input
              value={goal}
              onChange={e => setGoal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && generatePlan()}
              placeholder="e.g. Prepare for calculus exam in 7 days"
              className="flex-1 bg-white/5 border border-white/10 text-white placeholder:text-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500/50 transition-colors"
            />
            <button
              onClick={generatePlan}
              disabled={loading || !goal.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-sm font-semibold transition-all shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : "✦"}
              {loading ? "Generating…" : "Generate Plan"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
