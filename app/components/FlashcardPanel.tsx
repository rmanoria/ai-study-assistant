'use client';

import { AppState, esc } from '../types';

interface FlashcardPanelProps {
  S: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onSave: () => void;
  onToast: (msg: string, type?: string) => void;
}

export default function FlashcardPanel({ S, onUpdate, onSave, onToast }: FlashcardPanelProps) {
  async function genFC() {
    const topicEl = document.getElementById('fcTopic') as HTMLInputElement;
    const insEl = document.getElementById('fcInstruction') as HTMLInputElement;
    const t = (topicEl?.value || S.fcTopic || '').trim();
    const ins = (insEl?.value || '').trim();
    if (!t) return onToast('Please enter a topic', 'error');
    onUpdate({
      fcTopic: t, fcInstruction: ins, loadingTool: true, fcError: '',
      flashcards: [], fcFlipped: new Set(), fcMastered: new Set(), fcView: 'grid',
    });
    try {
      const r = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'flashcards', payload: { topic: t, count: String(S.fcCount), difficulty: S.fcDiff, instruction: ins } }),
      });
      const d = await r.json();
      if (d.data && Array.isArray(d.data)) {
        const cards = d.data.slice(0, S.fcCount);
        onUpdate({
          flashcards: cards,
          stats: { ...S.stats, totalCards: (S.stats.totalCards || 0) + cards.length },
          loadingTool: false,
        });
        onSave();
        onToast(`✓ ${cards.length} cards generated!`, 'success');
      } else {
        onUpdate({ fcError: d.error || 'Failed to generate. Please try again.', loadingTool: false });
      }
    } catch {
      onUpdate({ fcError: 'Connection error: check your API key.', loadingTool: false });
    }
  }

  function flipFC(i: number) {
    const n = new Set(S.fcFlipped);
    n.has(i) ? n.delete(i) : n.add(i);
    onUpdate({ fcFlipped: n });
  }

  function masterFC(i: number) {
    const n = new Set(S.fcMastered);
    n.has(i) ? n.delete(i) : n.add(i);
    const bump = n.has(i) ? 1 : 0;
    onUpdate({
      fcMastered: n,
      stats: { ...S.stats, cardsStudied: (S.stats.cardsStudied || 0) + bump },
    });
    onSave();
  }

  function shuffleFC() {
    onUpdate({
      flashcards: [...S.flashcards].sort(() => Math.random() - .5),
      fcFlipped: new Set(), fcStudyIdx: 0, fcStudyFlipped: false,
    });
    onToast('Cards shuffled!');
  }

  const fcView = S.fcView;

  if (fcView === 'results') {
    const m = S.fcMastered.size, t = S.flashcards.length;
    return (
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ width: 62, height: 62, borderRadius: 14, background: 'var(--grad-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: 'var(--glow-v)' }}>🏆</div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800 }}>Session Complete!</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t} cards reviewed</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 220 }}>
          <div className="stat-box"><div className="stat-v" style={{ color: 'var(--green)' }}>{m}</div><div className="stat-l">Mastered</div></div>
          <div className="stat-box"><div className="stat-v" style={{ color: 'var(--amber)' }}>{t - m}</div><div className="stat-l">To Review</div></div>
        </div>
        <div style={{ display: 'flex', gap: 9, width: '100%', maxWidth: 280 }}>
          <button className="pbtn" onClick={() => onUpdate({ fcView: 'study', fcStudyIdx: 0, fcStudyFlipped: false })}>Study Again</button>
          <button className="pbtn sec" style={{ flex: 1 }} onClick={() => onUpdate({ fcView: 'grid' })}>Grid</button>
        </div>
      </div>
    );
  }

  const m = S.fcMastered.size, t = S.flashcards.length, pct = t ? Math.round(m / t * 100) : 0;

  return (
    <div className="panel fade-up">
      <div className="ph">
        <div className="pi" style={{ background: 'rgba(124,90,240,.13)' }}>🃏</div>
        <div>
          <div className="ptitle">Flashcard Generator</div>
          <div className="psub">AI-powered decks with mastery tracking</div>
        </div>
      </div>

      <div className="sg">
        <div className="flbl">Topic or subject</div>
        <input className="fi" id="fcTopic" placeholder="e.g. Photosynthesis, French Revolution…" defaultValue={S.fcTopic} />
      </div>
      <div className="sg">
        <div className="flbl">Custom instruction (optional)</div>
        <input className="fi" id="fcInstruction" placeholder="e.g. Focus on dates, Include formulas…" defaultValue={S.fcInstruction || ''} />
      </div>

      <div className="row2 sg">
        <div>
          <div className="flbl">Difficulty</div>
          <div className="bgrp">
            {['easy','medium','hard','mixed'].map(d => (
              <button key={d} className={`bp${S.fcDiff === d ? ' sel' : ''}`} onClick={() => onUpdate({ fcDiff: d })}>
                {d === 'easy' ? '🟢 Easy' : d === 'medium' ? '🟡 Medium' : d === 'hard' ? '🔴 Hard' : '🎲 Mixed'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flbl">Count</div>
          <div className="bgrp">
            {[5,8,10,15,20,30].map(n => (
              <button key={n} className={`bp${S.fcCount === n ? ' sel' : ''}`} onClick={() => onUpdate({ fcCount: n })}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="sg">
        <button className="pbtn" onClick={genFC} disabled={S.loadingTool}>
          {S.loadingTool ? <><span className="spinning">⟳</span> Generating flashcards…</> : '✦ Generate Flashcards'}
        </button>
      </div>

      {S.fcError && <div className="ebox sg">{S.fcError}</div>}

      {S.flashcards.length > 0 && (
        <>
          <div className="card sg">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>Mastery</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--violet2)' }}>{pct}%</span>
            </div>
            <div className="pbar" style={{ height: 7 }}><div className="pfill" style={{ width: `${pct}%` }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginTop: 10 }}>
              <div className="stat-box"><div className="stat-v">{t}</div><div className="stat-l">Total</div></div>
              <div className="stat-box"><div className="stat-v" style={{ color: 'var(--green)' }}>{m}</div><div className="stat-l">Mastered</div></div>
              <div className="stat-box"><div className="stat-v" style={{ color: 'var(--amber)' }}>{t - m}</div><div className="stat-l">Left</div></div>
            </div>
            <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="aib violet" style={{ flex: 1 }}
                onClick={() => onUpdate({ fcView: fcView === 'grid' ? 'study' : 'grid', fcStudyIdx: 0, fcStudyFlipped: false })}>
                {fcView === 'grid' ? '📖 Study Mode' : '⊞ Grid View'}
              </button>
              <button className="aib" onClick={shuffleFC}>🔀 Shuffle</button>
              <button className="aib red" onClick={() => {
                if (confirm('Clear flashcards?')) onUpdate({ flashcards: [], fcFlipped: new Set(), fcMastered: new Set(), fcView: 'setup' }); onSave();
              }}>Clear</button>
            </div>
          </div>

          {fcView === 'study' ? (
            <FCStudy S={S} onUpdate={onUpdate} onMaster={masterFC} />
          ) : (
            <div className="fc-grid">
              {S.flashcards.map((c, i) => {
                const fl = S.fcFlipped.has(i), ms = S.fcMastered.has(i);
                return (
                  <div key={i} className="fc-wrap" onClick={() => flipFC(i)}>
                    <div className={`fci${fl ? ' fl' : ''}`} style={{ minHeight: 155 }}>
                      <div className="fc-face fc-front" style={ms ? { borderColor: 'rgba(16,185,129,.3)', background: 'rgba(16,185,129,.04)' } : {}}>
                        {ms && <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--green)', marginBottom: 5 }}>✓ MASTERED</div>}
                        <div className="fc-tag">{c.tag || 'Study'}</div>
                        <div className="fc-q">{c.q}</div>
                        <div className="fc-tip">Tap to reveal</div>
                      </div>
                      <div className="fc-face fc-back">
                        <div className="fc-ans-label">Answer</div>
                        <div className="fc-ans">{c.a}</div>
                        <button
                          className="fc-master-btn"
                          onClick={e => { e.stopPropagation(); masterFC(i); }}
                          style={{
                            border: `1px solid ${ms ? 'rgba(16,185,129,.4)' : 'var(--cardb)'}`,
                            background: ms ? 'rgba(16,185,129,.12)' : 'var(--card)',
                            color: ms ? 'var(--green)' : 'var(--text2)',
                          }}
                        >
                          {ms ? '✓ Mastered' : 'Mark Mastered'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {!S.loadingTool && !S.flashcards.length && !S.fcError && (
        <div className="empty">
          <div className="empty-ico">🃏</div>
          <div className="empty-t">No flashcards yet</div>
          <div className="empty-s">Enter a topic and generate a deck instantly.</div>
        </div>
      )}
    </div>
  );
}

function FCStudy({ S, onUpdate, onMaster }: { S: AppState; onUpdate: (p: Partial<AppState>) => void; onMaster: (i: number) => void }) {
  const { fcStudyIdx: i, flashcards: cards } = S;
  const c = cards[i];
  if (!c) return null;
  const m = S.fcMastered.size, t = cards.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingBottom: 20 }}>
      <div className="dot-row">
        {cards.map((_, j) => (
          <div key={j} className="dp"
            onClick={() => onUpdate({ fcStudyIdx: j, fcStudyFlipped: false })}
            style={{ width: j === i ? 18 : 7, height: 7, background: j === i ? 'var(--violet)' : S.fcMastered.has(j) ? 'var(--green)' : 'var(--cardb)' }}
          />
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i + 1} / {t} — {m} mastered</div>

      <div className="fc-wrap" style={{ width: '100%', maxWidth: 460 }}
        onClick={() => onUpdate({ fcStudyFlipped: !S.fcStudyFlipped })}>
        <div className={`fci${S.fcStudyFlipped ? ' fl' : ''}`} style={{ minHeight: 200 }}>
          <div className="fc-face fc-front">
            <div className="fc-tag">{c.tag || 'Study'}</div>
            <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.5, flex: 1 }}>{c.q}</div>
            {c.hint && <div className="fc-hint">💡 {c.hint}</div>}
            <div className="fc-tip">Tap to reveal</div>
          </div>
          <div className="fc-face fc-back">
            <div className="fc-ans-label">Answer</div>
            <div style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.5, flex: 1 }}>{c.a}</div>
            <button className="fc-master-btn"
              onClick={e => { e.stopPropagation(); onMaster(i); }}
              style={{
                border: `1px solid ${S.fcMastered.has(i) ? 'rgba(16,185,129,.4)' : 'var(--cardb)'}`,
                background: S.fcMastered.has(i) ? 'rgba(16,185,129,.12)' : 'var(--card)',
                color: S.fcMastered.has(i) ? 'var(--green)' : 'var(--text2)',
              }}
            >
              {S.fcMastered.has(i) ? '✓ Mastered' : 'Mark as Mastered'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 9, width: '100%', maxWidth: 460 }}>
        <button className="pbtn sec" style={{ flex: 1 }} disabled={i === 0}
          onClick={() => onUpdate({ fcStudyIdx: Math.max(0, i - 1), fcStudyFlipped: false })}>← Prev</button>
        <button className="pbtn" style={{ flex: 2 }}
          onClick={() => {
            if (i >= cards.length - 1) onUpdate({ fcView: 'results' });
            else onUpdate({ fcStudyIdx: i + 1, fcStudyFlipped: false });
          }}>
          {i === cards.length - 1 ? '🏆 Finish' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
