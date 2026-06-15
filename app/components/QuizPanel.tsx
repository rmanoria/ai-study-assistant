'use client';

import { AppState, MODES } from '../types';

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

  if (S.quizPhase === 'result') {
    const pct = Math.round(S.quizScore / S.questions.length * 100);
    const passed = pct >= 70;
    return (
      <div className="panel fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>{passed ? '🏆' : '📚'}</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{passed ? 'Great job!' : 'Keep studying!'}</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: passed ? 'var(--green)' : 'var(--amber)' }}>{pct}%</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>{S.quizScore} / {S.questions.length} correct</div>
        <div style={{ display: 'flex', gap: 9, width: '100%', maxWidth: 300 }}>
          <button className="pbtn" onClick={() => onUpdate({ quizPhase: 'setup', questions: [] })}>New Quiz</button>
          {S.wrongIdxs.length > 0 && (
            <button className="pbtn sec" onClick={() => onUpdate({
              questions: S.wrongIdxs.map(i => S.questions[i]),
              quizPhase: 'active', quizIdx: 0, quizScore: 0, wrongIdxs: [],
              selectedMCQ: null, selectedTF: null, saInput: '', saResult: null, showExplain: false,
            })}>Retry Wrong</button>
          )}
        </div>
      </div>
    );
  }

  // Active quiz
  const q = S.questions[S.quizIdx];
  if (!q) return null;
  const pct = S.quizIdx / S.questions.length;

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{S.quizIdx + 1} / {S.questions.length}</span>
        <div className="qz-prog">
          {S.questions.map((_, i) => (
            <div key={i} className="qz-dot" style={{
              background: i < S.quizIdx ? (S.wrongIdxs.includes(i) ? 'var(--rose)' : 'var(--green)') : i === S.quizIdx ? 'var(--violet)' : 'var(--cardb)'
            }} />
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Score: {S.quizScore}</span>
      </div>

      <div className="pbar sg"><div className="pfill" style={{ width: `${pct * 100}%` }} /></div>

      <div className="card sg" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{q.question}</div>

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
              <button key={i} className={cls}
                onClick={() => {
                  if (S.selectedMCQ !== null) return;
                  onUpdate({ selectedMCQ: i });
                }}>
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
          {S.showExplain && q.explanation && (
            <div className="exp-box">{q.explanation}</div>
          )}
        </div>
      )}

      {q.type === 'tf' && (
        <div style={{ display: 'flex', gap: 9 }}>
          {[true, false].map(val => {
            const revealed = S.selectedTF !== null;
            const isCorrect = String(val) === q.answer.toLowerCase() || (val && q.answer.toLowerCase() === 'true') || (!val && q.answer.toLowerCase() === 'false');
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

      {q.type === 'short' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <textarea className="fi" id="saInput" rows={3} placeholder="Type your answer…" defaultValue={S.saInput} />
          <div style={{ display: 'flex', gap: 7 }}>
            <button className="pbtn" onClick={checkShort} disabled={S.loadingTool}>
              {S.loadingTool ? <><span className="spinning">⟳</span></> : '✓ Check Answer'}
            </button>
            {S.saResult && <button className="pbtn sec" onClick={() => advance(S.saResult?.toLowerCase().includes('correct') || false)}>Next →</button>}
          </div>
          {S.saResult && (
            <div className={`exp-box${S.saResult.toLowerCase().includes('correct') ? '' : ''}`}>
              {S.saResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
