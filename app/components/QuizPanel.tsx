'use client';

import { AppState } from '../types';

interface QuizPanelProps {
  S: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onSave: () => void;
  onToast: (msg: string, type?: string) => void;
}

export default function QuizPanel({ S, onUpdate, onSave, onToast }: QuizPanelProps) {

  async function genQuiz() {
    const topicEl = document.getElementById('qzTopic') as HTMLInputElement;
    const t = (topicEl?.value || S.qzTopic || '').trim();
    if (!t) return onToast('Please enter a topic', 'error');
    onUpdate({ qzTopic: t, loadingTool: true, qzError: '', questions: [] });
    try {
      const r = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'quiz', payload: { topic: t, type: S.qzType, count: String(S.qzCount), difficulty: S.qzDiff } }),
      });
      const d = await r.json();
      if (d.data && Array.isArray(d.data)) {
        onUpdate({
          questions: d.data.slice(0, S.qzCount),
          quizPhase: 'active',
          quizIdx: 0, quizScore: 0, wrongIdxs: [],
          selectedMCQ: null, selectedTF: null,
          saInput: '', saResult: null, showExplain: false,
          loadingTool: false,
          stats: { ...S.stats, totalQuizzes: (S.stats.totalQuizzes || 0) + 1 },
        });
      } else {
        onUpdate({ qzError: d.error || 'Failed to generate quiz.', loadingTool: false });
      }
    } catch {
      onUpdate({ qzError: 'Connection error — check your API key.', loadingTool: false });
    }
  }

  function endQuizNow() {
    if (!confirm('End quiz early? Your current progress will be recorded.')) return;
    onUpdate({
      quizPhase: 'result',
      // wrongIdxs already tracked; unanswered questions counted as wrong
      wrongIdxs: [
        ...S.wrongIdxs,
        ...Array.from({ length: S.questions.length - S.quizIdx - 1 }, (_, i) => S.quizIdx + 1 + i),
      ],
    });
  }

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (S.quizPhase === 'setup') {
    return (
      <div className="panel fade-up">
        <div className="ph">
          <div className="pi" style={{ background: 'rgba(124,90,240,.13)' }}>🧠</div>
          <div><div className="ptitle">Quiz Generator</div><div className="psub">Test your knowledge with AI-generated quizzes</div></div>
        </div>
        <div className="sg">
          <div className="flbl">Topic</div>
          <input className="fi" id="qzTopic" placeholder="e.g. World War II, Calculus, Python…" defaultValue={S.qzTopic} />
        </div>
        <div className="row2 sg">
          <div>
            <div className="flbl">Type</div>
            <div className="bgrp">
              {[['mcq','Multiple Choice'],['tf','True/False'],['short','Short Answer']].map(([v,l]) => (
                <button key={v} className={`bp${S.qzType === v ? ' sel' : ''}`} onClick={() => onUpdate({ qzType: v })}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flbl">Difficulty</div>
            <div className="bgrp">
              {['easy','medium','hard'].map(d => (
                <button key={d} className={`bp${S.qzDiff === d ? ' sel' : ''}`} onClick={() => onUpdate({ qzDiff: d })}>
                  {d === 'easy' ? '🟢 Easy' : d === 'medium' ? '🟡 Medium' : '🔴 Hard'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="sg">
          <div className="flbl">Questions</div>
          <div className="bgrp">
            {[5,8,10,15,20].map(n => (
              <button key={n} className={`bp${S.qzCount === n ? ' sel' : ''}`} onClick={() => onUpdate({ qzCount: n })}>{n}</button>
            ))}
          </div>
        </div>
        <div className="sg">
          <button className="pbtn" onClick={genQuiz} disabled={S.loadingTool}>
            {S.loadingTool ? <><span className="spinning">⟳</span> Generating quiz…</> : '🧠 Start Quiz'}
          </button>
        </div>
        {S.qzError && <div className="ebox">{S.qzError}</div>}
      </div>
    );
  }

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if (S.quizPhase === 'result') {
    const total = S.questions.length;
    const correct = S.quizScore;
    const wrong = S.wrongIdxs.length;
    const skipped = total - correct - wrong;
    const pct = Math.round(correct / total * 100);
    const passed = pct >= 70;

    // Grade label
    const grade = pct >= 90 ? { lbl: 'A+', col: '#10b981' }
      : pct >= 80 ? { lbl: 'A', col: '#10b981' }
      : pct >= 70 ? { lbl: 'B', col: '#22d3ee' }
      : pct >= 60 ? { lbl: 'C', col: '#f59e0b' }
      : pct >= 50 ? { lbl: 'D', col: '#f97316' }
      : { lbl: 'F', col: '#f43f5e' };

    const tips: string[] = [];
    if (pct < 70) tips.push('Review the questions you got wrong and try again.');
    if (wrong > 0) tips.push(`Focus on ${wrong} incorrect answer${wrong > 1 ? 's' : ''} — use the Retry Wrong button.`);
    if (pct >= 90) tips.push('Excellent mastery! Try a harder difficulty next time.');
    if (pct >= 70 && pct < 90) tips.push('Good work! A few more reviews and you\'ll ace it.');

    return (
      <div className="panel fade-up">

        {/* Score hero */}
        <div className="qz-result-hero">
          <div style={{ fontSize: 48, lineHeight: 1 }}>{passed ? '🏆' : pct >= 50 ? '📚' : '💪'}</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
              {passed ? 'Great job!' : pct >= 50 ? 'Keep studying!' : 'Don\'t give up!'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{S.qzTopic}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: grade.col, lineHeight: 1 }}>{grade.lbl}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{pct}%</div>
          </div>
        </div>

        {/* Stat row */}
        <div className="qz-stat-row sg">
          <div className="qz-stat-box" style={{ borderColor: 'rgba(16,185,129,.3)', background: 'rgba(16,185,129,.07)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{correct}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Correct</div>
          </div>
          <div className="qz-stat-box" style={{ borderColor: 'rgba(244,63,94,.3)', background: 'rgba(244,63,94,.07)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--rose)' }}>{wrong}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Wrong</div>
          </div>
          <div className="qz-stat-box" style={{ borderColor: 'rgba(124,90,240,.3)', background: 'rgba(124,90,240,.07)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--violet2)' }}>{total}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="pbar sg" style={{ height: 8, borderRadius: 4 }}>
          <div className="pfill" style={{ width: `${pct}%`, background: grade.col }} />
        </div>

        {/* Tips */}
        {tips.length > 0 && (
          <div className="card sg" style={{ borderColor: 'rgba(124,90,240,.2)', background: 'rgba(124,90,240,.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>💡 Study Tips</div>
            {tips.map((tip, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4, paddingLeft: 12, borderLeft: '2px solid var(--violet)', lineHeight: 1.5 }}>{tip}</div>
            ))}
          </div>
        )}

        {/* Question review */}
        {S.questions.length > 0 && (
          <div className="sg">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>📋 Question Review</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {S.questions.map((q, i) => {
                const isWrong = S.wrongIdxs.includes(i);
                const isCorrect = !isWrong && i < S.quizIdx + (S.quizPhase === 'result' ? 1 : 0);
                return (
                  <div key={i} className="qz-review-row" style={{
                    borderColor: isCorrect ? 'rgba(16,185,129,.3)' : isWrong ? 'rgba(244,63,94,.25)' : 'var(--cardb)',
                    background: isCorrect ? 'rgba(16,185,129,.05)' : isWrong ? 'rgba(244,63,94,.05)' : 'var(--card)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{isCorrect ? '✅' : isWrong ? '❌' : '⬜'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4, lineHeight: 1.4 }}>
                          Q{i + 1}. {q.question}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>
                          ✓ Answer: {q.answer}
                        </div>
                        {q.explanation && (
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic', lineHeight: 1.5 }}>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button className="pbtn" style={{ flex: 1, minWidth: 120 }} onClick={() => onUpdate({ quizPhase: 'setup', questions: [] })}>
            🔄 New Quiz
          </button>
          {S.wrongIdxs.length > 0 && (
            <button className="pbtn sec" style={{ flex: 1, minWidth: 120 }} onClick={() => onUpdate({
              questions: S.wrongIdxs.map(i => S.questions[i]),
              quizPhase: 'active', quizIdx: 0, quizScore: 0, wrongIdxs: [],
              selectedMCQ: null, selectedTF: null, saInput: '', saResult: null, showExplain: false,
            })}>
              🔁 Retry Wrong ({S.wrongIdxs.length})
            </button>
          )}
          <button className="pbtn sec" style={{ flex: 1, minWidth: 120 }} onClick={() => onUpdate({
            questions: [...S.questions].sort(() => Math.random() - 0.5),
            quizPhase: 'active', quizIdx: 0, quizScore: 0, wrongIdxs: [],
            selectedMCQ: null, selectedTF: null, saInput: '', saResult: null, showExplain: false,
          })}>
            🔀 Retake All
          </button>
        </div>
      </div>
    );
  }

  // ── ACTIVE ─────────────────────────────────────────────────────────────────
  const q = S.questions[S.quizIdx];
  if (!q) return null;
  const progressPct = S.quizIdx / S.questions.length;

  async function checkShort() {
    const el = document.getElementById('saInput') as HTMLTextAreaElement;
    const ans = el?.value || '';
    if (!ans.trim()) return;
    onUpdate({ loadingTool: true, saInput: ans });
    try {
      const r = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'check_answer', payload: { question: q.question, expected: q.answer, given: ans } }),
      });
      const d = await r.json();
      onUpdate({ saResult: d.result || 'Could not evaluate.', showExplain: false, loadingTool: false });
    } catch {
      onUpdate({ saResult: 'Connection error.', loadingTool: false });
    }
  }

  function advance(correct: boolean) {
    const newScore = S.quizScore + (correct ? 1 : 0);
    const newWrong = correct ? S.wrongIdxs : [...S.wrongIdxs, S.quizIdx];
    if (S.quizIdx + 1 >= S.questions.length) {
      onUpdate({
        quizPhase: 'result', quizScore: newScore, wrongIdxs: newWrong,
        stats: { ...S.stats, quizzesPassed: (S.stats.quizzesPassed || 0) + (correct ? 1 : 0) },
      });
    } else {
      onUpdate({
        quizIdx: S.quizIdx + 1, quizScore: newScore, wrongIdxs: newWrong,
        selectedMCQ: null, selectedTF: null, saInput: '', saResult: null, showExplain: false,
      });
    }
  }

  return (
    <div className="panel fade-up">
      {/* Header with End Quiz button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
            {S.quizIdx + 1} / {S.questions.length}
          </span>
          <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>
            ✓ {S.quizScore}
          </span>
          {S.wrongIdxs.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--rose)', fontWeight: 600 }}>
              ✗ {S.wrongIdxs.length}
            </span>
          )}
        </div>
        {/* Progress dots */}
        <div className="qz-prog" style={{ flex: 1, justifyContent: 'center', padding: '0 12px' }}>
          {S.questions.map((_, i) => (
            <div key={i} className="qz-dot" style={{
              background: i < S.quizIdx
                ? (S.wrongIdxs.includes(i) ? 'var(--rose)' : 'var(--green)')
                : i === S.quizIdx ? 'var(--violet)' : 'var(--cardb)',
            }} />
          ))}
        </div>
        {/* END QUIZ button */}
        <button
          className="aib red"
          onClick={endQuizNow}
          style={{ fontSize: 11, fontWeight: 700, flexShrink: 0 }}
        >
          ✕ End Quiz
        </button>
      </div>

      {/* Progress bar */}
      <div className="pbar sg"><div className="pfill" style={{ width: `${progressPct * 100}%` }} /></div>

      {/* Question */}
      <div className="card sg" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--violet2)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
          Question {S.quizIdx + 1} · {S.qzDiff} · {q.type === 'mcq' ? 'Multiple Choice' : q.type === 'tf' ? 'True / False' : 'Short Answer'}
        </div>
        {q.question}
      </div>

      {/* MCQ */}
      {q.type === 'mcq' && q.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {q.options.map((opt, i) => {
            const letters = ['A','B','C','D'];
            const revealed = S.selectedMCQ !== null;
            const isCorrect = opt === q.answer;
            const isSelected = S.selectedMCQ === i;
            let cls = 'qz-opt';
            if (revealed) {
              if (isCorrect) cls += ' cor';
              else if (isSelected && !isCorrect) cls += ' wr';
            } else if (isSelected) cls += ' sel';
            return (
              <button key={i} className={cls} onClick={() => { if (S.selectedMCQ !== null) return; onUpdate({ selectedMCQ: i }); }}>
                <div className="opt-key">{letters[i]}</div>
                {opt}
              </button>
            );
          })}
          {S.selectedMCQ !== null && (
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {q.explanation && (
                <button className="aib" onClick={() => onUpdate({ showExplain: !S.showExplain })}>
                  💡 {S.showExplain ? 'Hide' : 'Explain'}
                </button>
              )}
              <button className="pbtn" style={{ flex: 1 }} onClick={() => advance(q.options![S.selectedMCQ!] === q.answer)}>
                Next →
              </button>
            </div>
          )}
          {S.showExplain && q.explanation && <div className="exp-box">{q.explanation}</div>}
        </div>
      )}

      {/* True/False */}
      {q.type === 'tf' && (
        <div style={{ display: 'flex', gap: 9 }}>
          {[true, false].map(val => {
            const revealed = S.selectedTF !== null;
            const isCorrect = (val && ['true','yes'].includes(q.answer.toLowerCase())) || (!val && ['false','no'].includes(q.answer.toLowerCase()));
            const isSelected = S.selectedTF === val;
            let cls = 'qz-opt';
            if (revealed) {
              if (isCorrect) cls += ' cor';
              else if (isSelected) cls += ' wr';
            } else if (isSelected) cls += ' sel';
            return (
              <button key={String(val)} className={cls} style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => { if (S.selectedTF !== null) return; onUpdate({ selectedTF: val }); }}>
                {val ? '✓ True' : '✗ False'}
              </button>
            );
          })}
          {S.selectedTF !== null && (
            <button className="pbtn" onClick={() => {
              const correct = (S.selectedTF && ['true','yes'].includes(q.answer.toLowerCase())) ||
                              (!S.selectedTF && ['false','no'].includes(q.answer.toLowerCase()));
              advance(!!correct);
            }}>Next →</button>
          )}
        </div>
      )}

      {/* Short Answer */}
      {q.type === 'short' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <textarea className="fi" id="saInput" rows={3} placeholder="Type your answer…" defaultValue={S.saInput} />
          <div style={{ display: 'flex', gap: 7 }}>
            <button className="pbtn" onClick={checkShort} disabled={S.loadingTool}>
              {S.loadingTool ? <><span className="spinning">⟳</span></> : '✓ Check Answer'}
            </button>
            {S.saResult && <button className="pbtn sec" onClick={() => advance(S.saResult?.toLowerCase().includes('correct') || false)}>Next →</button>}
          </div>
          {S.saResult && <div className="exp-box">{S.saResult}</div>}
        </div>
      )}
    </div>
  );
}
