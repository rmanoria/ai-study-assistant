"use client";

import { useState, useEffect } from "react";
import { Loader2, CalendarDays, Plus, CheckSquare, Square } from "lucide-react";

type Task = { text: string; done: boolean };
type Subject = { name: string; color: string; tasks: Task[] };

const DEFAULT_SUBJECTS: Subject[] = [
  {
    name: "Mathematics",
    color: "#6c63ff",
    tasks: [
      { text: "Complete problem set 4", done: false },
      { text: "Review integration techniques", done: true },
      { text: "Watch Khan Academy video on derivatives", done: false },
    ],
  },
  {
    name: "Biology",
    color: "#10b981",
    tasks: [
      { text: "Read Chapter 7: Cell Division", done: false },
      { text: "Make flashcards for organelles", done: true },
      { text: "Review photosynthesis notes", done: false },
    ],
  },
  {
    name: "History",
    color: "#f59e0b",
    tasks: [
      { text: "Outline WW2 timeline", done: false },
      { text: "Essay draft: Cold War causes", done: false },
      { text: "Review lecture slides", done: true },
    ],
  },
];

export default function PlannerPanel() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0, 1, 2]));
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("studyai-planner");
    setSubjects(saved ? JSON.parse(saved) : DEFAULT_SUBJECTS);
  }, []);

  function save(updated: Subject[]) {
    setSubjects(updated);
    localStorage.setItem("studyai-planner", JSON.stringify(updated));
  }

  function toggleTask(si: number, ti: number) {
    const updated = subjects.map((s, i) =>
      i === si
        ? { ...s, tasks: s.tasks.map((t, j) => (j === ti ? { ...t, done: !t.done } : t)) }
        : s
    );
    save(updated);
  }

  function addTask(si: number) {
    const text = prompt("New task:");
    if (!text) return;
    const updated = subjects.map((s, i) =>
      i === si ? { ...s, tasks: [...s.tasks, { text, done: false }] } : s
    );
    save(updated);
  }

  function addSubject() {
    const name = prompt("Subject name:");
    if (!name) return;
    const colors = ["#6c63ff", "#10b981", "#f59e0b", "#ec4899", "#22d3ee", "#f97316"];
    save([...subjects, { name, color: colors[subjects.length % colors.length], tasks: [] }]);
    setExpanded((prev) => new Set([...prev, subjects.length]));
  }

  function toggleExpanded(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function generatePlan() {
    if (!goal.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "studyplan", payload: { goal } }),
      });
      const data = await res.json();
      if (data.data) {
        const plan: Subject[] = data.data.map(
          (s: { name: string; color: string; tasks: string[] }) => ({
            ...s,
            tasks: s.tasks.map((t: string) => ({ text: t, done: false })),
          })
        );
        save(plan);
        setExpanded(new Set(plan.map((_, i) => i)));
        setGoal("");
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  const totalTasks = subjects.reduce((a, s) => a + s.tasks.length, 0);
  const doneTasks = subjects.reduce((a, s) => a + s.tasks.filter((t) => t.done).length, 0);
  const overallPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex flex-col gap-5 p-6 overflow-y-auto flex-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-pink-500/20 border border-pink-500/30">
            <CalendarDays size={20} className="text-pink-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Study Planner</h2>
            <p className="text-sm text-gray-400">Track subjects and tasks</p>
          </div>
        </div>
        <button
          onClick={addSubject}
          className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-all"
        >
          <Plus size={13} /> Add Subject
        </button>
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
              style={{ width: `${overallPct}%`, background: "linear-gradient(90deg, #6c63ff, #a78bfa)" }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {doneTasks} of {totalTasks} tasks completed
          </div>
        </div>
      )}

      {/* Subjects */}
      <div className="flex flex-col gap-3">
        {subjects.map((subj, si) => {
          const done = subj.tasks.filter((t) => t.done).length;
          const pct = subj.tasks.length ? Math.round((done / subj.tasks.length) * 100) : 0;
          const isOpen = expanded.has(si);

          return (
            <div key={si} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {/* Subject header */}
              <div
                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => toggleExpanded(si)}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: subj.color }} />
                <div className="flex-1 font-semibold text-sm text-white">{subj.name}</div>
                <div className="text-xs text-gray-500 mr-2">
                  {done}/{subj.tasks.length}
                </div>
                <div
                  className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: subj.color }}
                  />
                </div>
                <span className="text-gray-500 text-xs ml-2">{isOpen ? "▲" : "▼"}</span>
              </div>

              {/* Tasks */}
              {isOpen && (
                <div className="px-5 pb-4 flex flex-col gap-2 border-t border-white/5">
                  {subj.tasks.map((task, ti) => (
                    <div
                      key={ti}
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => toggleTask(si, ti)}
                    >
                      <div className="text-gray-500 group-hover:text-gray-300 transition-colors mt-0.5 shrink-0">
                        {task.done ? (
                          <CheckSquare size={15} style={{ color: subj.color }} />
                        ) : (
                          <Square size={15} />
                        )}
                      </div>
                      <span
                        className={`text-sm transition-all ${
                          task.done ? "line-through text-gray-600" : "text-gray-300"
                        }`}
                      >
                        {task.text}
                      </span>
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

      {/* AI Plan Generator */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="font-semibold text-sm text-white mb-3">
          🤖 AI Study Plan Generator
        </div>
        <div className="flex gap-3">
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generatePlan()}
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
        <p className="text-xs text-gray-600 mt-2">
          AI will create a full subject breakdown with tasks based on your goal.
        </p>
      </div>
    </div>
  );
}
