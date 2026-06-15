'use client';

import { AppState, Plan, PlanSubject, PlanTask, COLORS, uid } from '../types';

interface PlannerPanelProps {
  S: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onSave: () => void;
  onToast: (msg: string, type?: string) => void;
}

export default function PlannerPanel({ S, onUpdate, onSave, onToast }: PlannerPanelProps) {
  const activePlan = S.plans.find(p => p.id === S.activePlanId);

  function newPlan() {
    const p: Plan = {
      id: uid(), name: 'New Study Plan',
      subjects: [{ id: uid(), name: 'Subject 1', color: COLORS[0], tasks: [] }],
      created: new Date().toLocaleDateString(),
    };
    onUpdate({ plans: [p, ...S.plans], activePlanId: p.id });
    onSave();
  }

  function deletePlan(id: string) {
    if (!confirm('Delete this plan?')) return;
    const plans = S.plans.filter(p => p.id !== id);
    onUpdate({ plans, activePlanId: plans[0]?.id || null });
    onSave();
  }

  function updatePlanName(val: string) {
    if (!activePlan) return;
    const plans = S.plans.map(p => p.id === activePlan.id ? { ...p, name: val } : p);
    onUpdate({ plans });
  }

  function addSubject() {
    if (!activePlan) return;
    const newSub: PlanSubject = { id: uid(), name: 'New Subject', color: COLORS[activePlan.subjects.length % COLORS.length], tasks: [] };
    const plans = S.plans.map(p => p.id === activePlan.id ? { ...p, subjects: [...p.subjects, newSub] } : p);
    onUpdate({ plans });
    onSave();
  }

  function updateSubjectName(subId: string, val: string) {
    if (!activePlan) return;
    const plans = S.plans.map(p => p.id === activePlan.id
      ? { ...p, subjects: p.subjects.map(s => s.id === subId ? { ...s, name: val } : s) }
      : p);
    onUpdate({ plans });
  }

  function deleteSubject(subId: string) {
    if (!activePlan) return;
    const plans = S.plans.map(p => p.id === activePlan.id
      ? { ...p, subjects: p.subjects.filter(s => s.id !== subId) }
      : p);
    onUpdate({ plans });
    onSave();
  }

  function addTask(subId: string) {
    if (!activePlan) return;
    const task: PlanTask = { id: uid(), text: 'New task', done: false, priority: 'medium' };
    const plans = S.plans.map(p => p.id === activePlan.id
      ? { ...p, subjects: p.subjects.map(s => s.id === subId ? { ...s, tasks: [...s.tasks, task] } : s) }
      : p);
    onUpdate({ plans });
    onSave();
  }

  function toggleTask(subId: string, taskId: string) {
    if (!activePlan) return;
    const plans = S.plans.map(p => p.id === activePlan.id
      ? { ...p, subjects: p.subjects.map(s => s.id === subId
          ? { ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) }
          : s) }
      : p);
    onUpdate({ plans });
    onSave();
  }

  function updateTaskText(subId: string, taskId: string, val: string) {
    if (!activePlan) return;
    const plans = S.plans.map(p => p.id === activePlan.id
      ? { ...p, subjects: p.subjects.map(s => s.id === subId
          ? { ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, text: val } : t) }
          : s) }
      : p);
    onUpdate({ plans });
  }

  function deleteTask(subId: string, taskId: string) {
    if (!activePlan) return;
    const plans = S.plans.map(p => p.id === activePlan.id
      ? { ...p, subjects: p.subjects.map(s => s.id === subId
          ? { ...s, tasks: s.tasks.filter(t => t.id !== taskId) }
          : s) }
      : p);
    onUpdate({ plans });
    onSave();
  }

  function toggleSubject(subId: string) {
    const n = new Set(S.expandedSubjects);
    n.has(subId) ? n.delete(subId) : n.add(subId);
    onUpdate({ expandedSubjects: n });
  }

  const priColors: Record<string, string> = { high: '#f43f5e', medium: '#f59e0b', low: '#10b981' };

  async function genPlan() {
    const topicEl = document.getElementById('planTopic') as HTMLInputElement;
    const topic = topicEl?.value.trim();
    if (!topic) return onToast('Enter a topic to generate a plan', 'error');
    onUpdate({ loadingTool: true });
    try {
      const r = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'planner', payload: { topic } }),
      });
      const d = await r.json();
      if (d.data) {
        const plan: Plan = {
          id: uid(), name: d.data.name || topic,
          subjects: (d.data.subjects || []).map((s: { name: string; tasks: string[] }, i: number) => ({
            id: uid(), name: s.name, color: COLORS[i % COLORS.length],
            tasks: (s.tasks || []).map((t: string) => ({ id: uid(), text: t, done: false, priority: 'medium' as const })),
          })),
          created: new Date().toLocaleDateString(),
        };
        onUpdate({ plans: [plan, ...S.plans], activePlanId: plan.id, loadingTool: false });
        onSave();
        onToast('Study plan generated!', 'success');
      } else {
        onUpdate({ loadingTool: false });
        onToast(d.error || 'Failed to generate plan', 'error');
      }
    } catch {
      onUpdate({ loadingTool: false });
      onToast('Connection error', 'error');
    }
  }

  return (
    <div className="pl-layout">
      {/* Sidebar */}
      <div className={`pl-sidebar${S.mobileOpen ? ' show' : ''}`}>
        <div className="pl-hd">
          <button className="new-chat" onClick={newPlan}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Plan
          </button>
        </div>
        <div className="pl-items">
          {S.plans.length === 0 && (
            <div className="empty" style={{ padding: '20px 8px' }}>
              <div className="empty-ico">📅</div>
              <div className="empty-s">No plans yet</div>
            </div>
          )}
          {S.plans.map(p => {
            const total = p.subjects.reduce((a, s) => a + s.tasks.length, 0);
            const done  = p.subjects.reduce((a, s) => a + s.tasks.filter(t => t.done).length, 0);
            return (
              <div key={p.id} className={`pi-item${p.id === S.activePlanId ? ' on' : ''}`} onClick={() => onUpdate({ activePlanId: p.id })}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div className="pi-name">{p.name}</div>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 12 }}
                    onClick={e => { e.stopPropagation(); deletePlan(p.id); }}>✕</button>
                </div>
                <div className="pi-meta">{done}/{total} tasks · {p.created}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main */}
      <div className="pl-main">
        {!activePlan ? (
          <div>
            <div className="ph">
              <div className="pi" style={{ background: 'rgba(99,102,241,.12)' }}>📅</div>
              <div><div className="ptitle">Study Planner</div><div className="psub">AI-generated or custom study schedules</div></div>
            </div>
            <div className="card sg" style={{ display: 'flex', gap: 9 }}>
              <input className="fi" id="planTopic" placeholder="e.g. IELTS exam in 4 weeks, Final exams…" style={{ flex: 1 }} />
              <button className="pbtn" style={{ width: 'auto', padding: '0 16px' }} onClick={genPlan} disabled={S.loadingTool}>
                {S.loadingTool ? <span className="spinning">⟳</span> : '✦ AI Generate'}
              </button>
            </div>
            <div className="empty" style={{ marginTop: 20 }}>
              <div className="empty-ico">📅</div>
              <div className="empty-t">No plan selected</div>
              <div className="empty-s">Create a new plan or generate one with AI.</div>
              <button className="pbtn" style={{ marginTop: 12, width: 'auto', padding: '8px 20px' }} onClick={newPlan}>+ New Plan</button>
            </div>
          </div>
        ) : (
          <>
            <div className="ph" style={{ marginBottom: 14 }}>
              <div className="pi" style={{ background: 'rgba(99,102,241,.12)' }}>📅</div>
              <input
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font)' }}
                value={activePlan.name}
                onChange={e => updatePlanName(e.target.value)}
                onBlur={onSave}
              />
              <button className="aib" onClick={addSubject}>+ Subject</button>
            </div>

            {/* Plan progress */}
            {(() => {
              const total = activePlan.subjects.reduce((a, s) => a + s.tasks.length, 0);
              const done  = activePlan.subjects.reduce((a, s) => a + s.tasks.filter(t => t.done).length, 0);
              const pct   = total ? Math.round(done / total * 100) : 0;
              return total > 0 ? (
                <div className="card sg">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>Plan Progress</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--violet2)' }}>{pct}%</span>
                  </div>
                  <div className="pbar"><div className="pfill" style={{ width: `${pct}%` }} /></div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{done} of {total} tasks complete</div>
                </div>
              ) : null;
            })()}

            {activePlan.subjects.map(sub => {
              const done = sub.tasks.filter(t => t.done).length;
              const expanded = S.expandedSubjects.has(sub.id);
              return (
                <div key={sub.id} style={{ marginBottom: 12 }}>
                  <div className="subj-head" onClick={() => toggleSubject(sub.id)}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: sub.color, flexShrink: 0 }} />
                    <input
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font)' }}
                      value={sub.name}
                      onChange={e => updateSubjectName(sub.id, e.target.value)}
                      onBlur={onSave}
                      onClick={e => e.stopPropagation()}
                    />
                    <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>{done}/{sub.tasks.length}</span>
                    <button className="aib" style={{ fontSize: 10, padding: '2px 8px' }}
                      onClick={e => { e.stopPropagation(); addTask(sub.id); }}>+ Task</button>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 12 }}
                      onClick={e => { e.stopPropagation(); deleteSubject(sub.id); }}>✕</button>
                    <span style={{ color: 'var(--text3)', fontSize: 12 }}>{expanded ? '▾' : '▸'}</span>
                  </div>

                  {expanded && (
                    <div style={{ paddingLeft: 12 }}>
                      {sub.tasks.length === 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '8px 12px' }}>No tasks yet — click + Task above</div>
                      )}
                      {sub.tasks.map(task => (
                        <div key={task.id} className="task-row">
                          <div
                            className={`task-chk${task.done ? ' done' : ''}`}
                            onClick={() => toggleTask(sub.id, task.id)}
                          >
                            {task.done && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                                <polyline points="20,6 9,17 4,12"/>
                              </svg>
                            )}
                          </div>
                          <input
                            className={`task-text${task.done ? ' done' : ''}`}
                            style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font)', color: task.done ? 'var(--text3)' : 'var(--text2)' }}
                            value={task.text}
                            onChange={e => updateTaskText(sub.id, task.id, e.target.value)}
                            onBlur={onSave}
                          />
                          {task.priority && (
                            <span className="task-pri" style={{ background: `${priColors[task.priority]}22`, color: priColors[task.priority] }}>
                              {task.priority}
                            </span>
                          )}
                          <button style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 12 }}
                            onClick={() => deleteTask(sub.id, task.id)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
