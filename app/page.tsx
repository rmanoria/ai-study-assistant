'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AnimatedBackground from './components/AnimatedBackground';
import Navbar from './components/Navbar';
import ChatBubble from './components/ChatBubble';
import TypingLoader from './components/TypingLoader';
import FlashcardPanel from './components/FlashcardPanel';
import QuizPanel from './components/QuizPanel';
import NotesPanel from './components/NotesPanel';
import SummarizerPanel from './components/SummarizerPanel';
import PlannerPanel from './components/PlannerPanel';
import MediaLibrary from './components/MediaLibrary';
import ChatList from './components/ChatList';

import {
  AppState, ToolId, Chat, Note, Message, TOOLS, MODES, QPS, SHORTCUTS,
  NOTE_TAG_COLS, uid, mkChat, md2html, esc, getDefaultState,
} from './types';

// ─── Persistence ─────────────────────────────────────────────────────────────
function loadState(): AppState {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('sai3') : null;
    if (raw) {
      const p = JSON.parse(raw);
      const def = getDefaultState();
      return {
        ...def, ...p,
        fcFlipped: new Set<number>(),
        fcMastered: new Set<number>(),
        expandedSubjects: new Set<string>(p.expandedSubjects || []),
        loadingChat: false, loadingTool: false,
        noteLoadAction: null, mobileOpen: false,
        attachFile: null, attachPreview: null,
        sidebarCollapsed: p.sidebarCollapsed || false,
        stats: p.stats || def.stats,
        settings: p.settings || def.settings,
        pom: p.pom || def.pom,
      };
    }
  } catch (e) { console.warn('Load error:', e); }
  return getDefaultState();
}

function saveState(S: AppState) {
  try {
    const d = {
      ...S,
      fcFlipped: [],
      fcMastered: [],
      expandedSubjects: [...S.expandedSubjects],
      loadingChat: false, loadingTool: false,
      noteLoadAction: null, mobileOpen: false,
      attachFile: null, attachPreview: null,
    };
    localStorage.setItem('sai3', JSON.stringify(d));
  } catch (e) { console.warn('Save error:', e); }
}

// ─── Toast ───────────────────────────────────────────────────────────────────
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export default function Page() {
  const [S, setS] = useState<AppState>(getDefaultState);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [pomBadgeTime, setPomBadgeTime] = useState('25:00');
  const pomIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const loaded = loadState();
    checkStreak(loaded);
    setS(loaded);
  }, []);


  // Sync dark/light class on <html> so :root CSS variables cascade everywhere
  useEffect(() => {
    if (S.darkMode) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [S.darkMode]);

  // Save whenever state changes (debounced)
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => saveState(S), 300);
  }, [S]);

  // Pomodoro badge updater
  useEffect(() => {
    const interval = setInterval(() => {
      if (S.pom.running) {
        const rem = pomRemaining(S);
        setPomBadgeTime(pomFmt(rem));
        if (rem <= 0 && pomIntervalRef.current) {
          clearInterval(pomIntervalRef.current);
          pomIntervalRef.current = null;
          handlePomComplete();
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  });

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey) {
        const map: Record<string, ToolId> = { '1':'chat','2':'flashcards','3':'quiz','4':'notes','5':'summarizer','6':'planner' };
        if (map[e.key]) { e.preventDefault(); setTool(map[e.key]); return; }
        if (e.key === 'n') { e.preventDefault(); addNewChat(); return; }
        if (e.key === 'k') { e.preventDefault(); setTool('chat'); return; }
        if (e.key === 'd') { e.preventDefault(); update({ darkMode: !S.darkMode }); return; }
      }
      if (e.key === '?') setTool('settings');
      if (e.key === 'Escape') update({ mobileOpen: false });
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Auto-scroll chat
  useEffect(() => {
    if (S.tool === 'chat' && msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [S.tool, S.chats, S.loadingChat]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function update(patch: Partial<AppState>) {
    setS(prev => ({ ...prev, ...patch }));
  }

  function toast(msg: string, type = '') {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setToastVisible(false), 2200);
  }

  function setTool(id: ToolId | string) {
    setS(prev => {
      let chats = prev.chats;
      let activeChatId = prev.activeChatId;
      if (id === 'chat' && !activeChatId) {
        const c = mkChat();
        chats = [c, ...prev.chats];
        activeChatId = c.id;
      }
      return { ...prev, tool: id as ToolId, mobileOpen: false, chats, activeChatId };
    });
  }

  function addNewChat() {
    const c = mkChat();
    setS(prev => ({ ...prev, chats: [c, ...prev.chats], activeChatId: c.id, tool: 'chat', mobileOpen: false }));
  }

  function selChat(id: string) {
    setS(prev => ({ ...prev, activeChatId: id, tool: 'chat', mobileOpen: false }));
  }

  function delChat(id: string) {
    if (!confirm('Delete this chat?')) return;
    setS(prev => {
      let chats = prev.chats.filter(c => c.id !== id);
      let activeChatId = prev.activeChatId === id ? (chats[0]?.id || null) : prev.activeChatId;
      if (!chats.length) { const c = mkChat(); chats = [c]; activeChatId = c.id; }
      return { ...prev, chats, activeChatId };
    });
  }

  function renameChat(id: string, title: string) {
    setS(prev => ({ ...prev, chats: prev.chats.map(c => c.id === id ? { ...c, title } : c) }));
  }

  function starChat(id: string) {
    setS(prev => ({ ...prev, chats: prev.chats.map(c => c.id === id ? { ...c, starred: !c.starred } : c) }));
  }

  function archiveChat(id: string) {
    setS(prev => ({ ...prev, chats: prev.chats.map(c => c.id === id ? { ...c, archived: !c.archived } : c) }));
  }

  function duplicateChat(id: string) {
    const src = S.chats.find(c => c.id === id);
    if (!src) return;
    const dup = { ...src, id: uid(), title: src.title + ' (copy)', created: Date.now() };
    setS(prev => ({ ...prev, chats: [dup, ...prev.chats] }));
    toast('Chat duplicated', 'success');
  }

  function colorChat(id: string, color: string) {
    setS(prev => ({ ...prev, chats: prev.chats.map(c => c.id === id ? { ...c, color } : c) }));
  }

  function bumpActivity() {
    setS(prev => {
      const act = prev.stats.activity.length === 14 ? prev.stats.activity : Array(14).fill(0);
      return { ...prev, stats: { ...prev.stats, activity: [...act.slice(1), act[13] + 1] } };
    });
  }

  function checkStreak(state: AppState) {
    const today = new Date().toDateString();
    if (state.lastVisit === today) return state;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const streak = state.lastVisit === yesterday ? (state.stats.streak || 1) + 1 : 1;
    return { ...state, lastVisit: today, stats: { ...state.stats, streak } };
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────

  async function sendMsg() {
    const el = document.getElementById('ci') as HTMLTextAreaElement;
    const txt = (el?.value || '').trim();
    if ((!txt && !S.attachFile) || S.loadingChat) return;

    const chat = S.chats.find(c => c.id === S.activeChatId);
    if (!chat) return;

    // Build API content: user text + file context if attached
    const fileCtx = S.attachFile
      ? `\n[File attached: "${S.attachFile.name}" — answer the user's question about this file based on its name/context]`
      : '';
    const msgContent = (txt + fileCtx) || (S.attachFile ? `[File attached: "${S.attachFile.name}"] Please review and summarise this file.` : '');
    const msg: Message = { role: 'user', content: txt || '', ts: Date.now() };
    if (S.attachPreview) msg.imgData = S.attachPreview;
    if (S.attachFile) {
      msg.fileName = S.attachFile.name;
      const n = S.attachFile.name.toLowerCase();
      msg.fileType = S.attachFile.type.startsWith('image/') ? 'image'
        : n.endsWith('.pdf') ? 'pdf'
        : (n.endsWith('.docx') || n.endsWith('.doc')) ? 'doc'
        : 'txt';
    }

    const updatedChat: Chat = {
      ...chat,
      title: chat.title === 'New Chat' ? (txt ? txt.slice(0, 30) + (txt.length > 30 ? '…' : '') : S.attachFile ? S.attachFile.name.slice(0, 30) : chat.title) : chat.title,
      messages: [...chat.messages, msg],
    };

    if (el) { el.value = ''; el.style.height = 'auto'; }
    const hadAttach = !!S.attachFile;

    setS(prev => ({
      ...prev,
      chats: prev.chats.map(c => c.id === updatedChat.id ? updatedChat : c),
      loadingChat: true, attachFile: null, attachPreview: null,
    }));
    bumpActivity();

    try {
      const fd = new FormData();
      fd.append('messages', JSON.stringify([...chat.messages, { role: 'user', content: msgContent }].map(m => ({ role: m.role, content: m.content }))));
      fd.append('mode', S.mode);

      const r = await fetch('/api/chat', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();

      setS(prev => ({
        ...prev,
        chats: prev.chats.map(c => c.id === updatedChat.id
          ? { ...c, messages: [...c.messages, { role: 'assistant' as const, content: d.reply || 'No response received.', ts: Date.now() }] }
          : c),
        loadingChat: false,
        stats: { ...prev.stats, totalChats: prev.chats.length },
      }));
    } catch (err: unknown) {
      const msg2 = err instanceof Error ? err.message : 'Unknown error';
      setS(prev => ({
        ...prev,
        chats: prev.chats.map(c => c.id === updatedChat.id
          ? { ...c, messages: [...c.messages, { role: 'assistant' as const, content: `⚠️ **Connection error**\n\nCould not reach the API. Please check:\n1. Your \`GROQ_API_KEY\` is set in \`.env.local\`\n2. The dev server is running\n\nError: ${msg2}`, ts: Date.now() }] }
          : c),
        loadingChat: false,
      }));
    }
  }

  function handleAtt(inp: HTMLInputElement) {
    const f = inp.files?.[0]; if (!f) return;
    if (f.size > 15 * 1024 * 1024) { toast('File exceeds 15MB', 'error'); return; }
    const r = new FileReader();
    r.onload = e => {
      const dataUrl = e.target?.result as string;
      const isImage = f.type.startsWith('image/');
      const n = f.name.toLowerCase();
      const type: 'image' | 'pdf' | 'doc' | 'txt' =
        isImage ? 'image' : n.endsWith('.pdf') ? 'pdf' : (n.endsWith('.docx') || n.endsWith('.doc')) ? 'doc' : 'txt';
      // Auto-save to media library
      const mediaItem = { id: uid(), name: f.name, type, size: f.size, dataUrl, addedAt: new Date().toLocaleDateString() };
      setS(prev => ({
        ...prev,
        attachFile: f,
        attachPreview: isImage ? dataUrl : null,
        mediaItems: [mediaItem, ...(prev.mediaItems || [])],
      }));
    };
    r.readAsDataURL(f);
    inp.value = '';
    toast(`📎 ${f.name} attached & saved to library`);
  }

  function msgToFC(i: number) {
    const chat = S.chats.find(c => c.id === S.activeChatId);
    if (!chat?.messages[i]) return;
    update({ fcTopic: chat.messages[i].content.slice(0, 80), tool: 'flashcards' });
  }

  function msgToNote(i: number) {
    const chat = S.chats.find(c => c.id === S.activeChatId);
    if (!chat?.messages[i]) return;
    const n: Note = { id: uid(), title: 'From Chat — ' + new Date().toLocaleDateString(), body: chat.messages[i].content, created: new Date().toLocaleDateString(), tag: 'summary' };
    setS(prev => ({ ...prev, notes: [n, ...prev.notes], activeNoteId: n.id, tool: 'notes', stats: { ...prev.stats, totalNotes: prev.notes.length + 1 } }));
    toast('Saved to Notes!', 'success');
  }

  function msgToSum(i: number) {
    const chat = S.chats.find(c => c.id === S.activeChatId);
    if (!chat?.messages[i]) return;
    update({ sumInputText: chat.messages[i].content.slice(0, 8000), tool: 'summarizer' });
  }

  function setInp(t: string) {
    update({ tool: 'chat' });
    setTimeout(() => {
      const el = document.getElementById('ci') as HTMLTextAreaElement;
      if (el) { el.value = t; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 110) + 'px'; el.focus(); }
    }, 10);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && S.settings.sendOnEnter && !e.shiftKey) {
      e.preventDefault(); sendMsg();
    }
  }

  // ─── Pomodoro ──────────────────────────────────────────────────────────────

  function pomTotalSecs(state: AppState) {
    const p = state.pom;
    if (p.phase === 'work') return p.workMins * 60;
    if (p.phase === 'short') return p.shortMins * 60;
    return p.longMins * 60;
  }

  function pomRemaining(state: AppState) {
    return Math.max(0, pomTotalSecs(state) - state.pom.elapsed);
  }

  function pomFmt(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function pomStart() {
    if (pomIntervalRef.current) clearInterval(pomIntervalRef.current);
    setS(prev => ({ ...prev, pom: { ...prev.pom, running: true } }));
    pomIntervalRef.current = setInterval(() => {
      setS(prev => {
        const newElapsed = prev.pom.elapsed + 1;
        const total = pomTotalSecs(prev);
        const rem = Math.max(0, total - newElapsed);
        // Update ring
        const ring = document.getElementById('pomRingFg');
        const tv = document.getElementById('pomTime');
        if (tv) tv.textContent = pomFmt(rem);
        if (ring) {
          const circ = 2 * Math.PI * 88;
          ring.style.strokeDashoffset = String(circ * (1 - Math.max(0, newElapsed / total)));
        }
        if (rem <= 0) {
          clearInterval(pomIntervalRef.current!);
          pomIntervalRef.current = null;
          return handlePomCompleteState(prev);
        }
        return { ...prev, pom: { ...prev.pom, elapsed: newElapsed } };
      });
    }, 1000);
  }

  function handlePomCompleteState(prev: AppState): AppState {
    const p = prev.pom;
    let newPhase: 'work' | 'short' | 'long' = 'work';
    let sessions = p.sessions;
    if (p.phase === 'work') {
      sessions++;
      newPhase = sessions % p.target === 0 ? 'long' : 'short';
    }
    toast(newPhase === 'work' ? 'Break time! 🌿' : 'Focus time! 💪', 'success');
    return { ...prev, pom: { ...p, running: false, phase: newPhase, sessions, elapsed: 0 } };
  }

  function handlePomComplete() {
    setS(prev => handlePomCompleteState(prev));
  }

  function pomPause() {
    if (pomIntervalRef.current) { clearInterval(pomIntervalRef.current); pomIntervalRef.current = null; }
    setS(prev => ({ ...prev, pom: { ...prev.pom, running: false } }));
  }

  function pomReset() {
    if (pomIntervalRef.current) { clearInterval(pomIntervalRef.current); pomIntervalRef.current = null; }
    setS(prev => ({ ...prev, pom: { ...prev.pom, running: false, elapsed: 0 } }));
  }

  function pomSkip() {
    if (pomIntervalRef.current) { clearInterval(pomIntervalRef.current); pomIntervalRef.current = null; }
    setS(prev => ({
      ...prev,
      pom: { ...prev.pom, running: false, elapsed: 0, phase: prev.pom.phase === 'work' ? 'short' : 'work' },
    }));
  }

  function pomSetPhase(ph: 'work' | 'short' | 'long') {
    if (pomIntervalRef.current) { clearInterval(pomIntervalRef.current); pomIntervalRef.current = null; }
    setS(prev => ({ ...prev, pom: { ...prev.pom, running: false, phase: ph, elapsed: 0 } }));
  }

  // ─── Renders ───────────────────────────────────────────────────────────────

  function renderDashboard() {
    const st = S.stats;
    const activity = st.activity || Array(14).fill(0);
    const maxA = Math.max(...activity, 1);
    const statCards = [
      ['💬', S.chats.length, 'Chats', 'chat'],
      ['🃏', S.flashcards.length, 'Flashcards', 'flashcards'],
      ['🧠', st.totalQuizzes || 0, 'Quizzes', 'quiz'],
      ['📝', S.notes.length, 'Notes', 'notes'],
      ['📅', S.plans.length, 'Plans', 'planner'],
      ['🔥', st.streak || 1, 'Day streak', ''],
    ] as [string, number, string, string][];

    return (
      <div className="panel fade-up">
        <div className="dash-hero sg">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet2)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>✦ StudyAI</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2, marginBottom: 6 }}>Your intelligent<br />study companion</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>Powered by AI — flashcards, quizzes, smart notes, and an expert tutor.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="pbtn" style={{ width: 'auto', padding: '8px 16px', fontSize: 12 }} onClick={() => setTool('chat')}>💬 Start Studying</button>
            <button className="pbtn sec" style={{ width: 'auto', padding: '8px 16px', fontSize: 12 }} onClick={() => setTool('flashcards')}>🃏 Create Flashcards</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 9, marginBottom: 16 }}>
          {statCards.map(([ico, val, lbl, tool]) => (
            <div key={lbl} className="dash-card" style={{ cursor: tool ? 'pointer' : 'default' }} onClick={() => tool && setTool(tool as ToolId)}>
              <div className="dash-card-ico">{ico}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{val}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lbl}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 12 }}>Activity (14 days)</div>
            <div className="activity-bar">
              {activity.map((v, i) => (
                <div key={i} className={`ab-col${i === 13 ? ' today' : ''}`} style={{ height: Math.max(4, Math.round(v / maxA * 40)) }} title={`${v} sessions`} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 9, color: 'var(--text4)' }}>14 days ago</span>
              <span style={{ fontSize: 9, color: 'var(--text4)' }}>Today</span>
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['🃏','Generate flashcards','flashcards'],['🧠','Take a quiz','quiz'],['⚡','Summarize doc','summarizer'],['📝','New note','notes']].map(([ico, lbl, tool]) => (
                <button key={tool} className="tool-btn" onClick={() => setTool(tool as ToolId)} style={{ padding: '6px 9px' }}>
                  <span className="t-ico">{ico}</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{lbl}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', color: 'var(--text3)' }}><polyline points="9,18 15,12 9,6"/></svg>
                </button>
              ))}
            </div>
          </div>
        </div>

        {S.chats.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>Recent Chats</div>
            {S.chats.slice(0, 4).map(c => (
              <div key={c.id}
                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: '.13s', border: '1px solid transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--cardhover)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--cardb)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
                onClick={() => selChat(c.id)}
              >
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--grad-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>💬</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{c.messages.length} messages</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)', flexShrink: 0 }}><polyline points="9,18 15,12 9,6"/></svg>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderChat() {
    const chat = S.chats.find(c => c.id === S.activeChatId);
    const msgs = chat?.messages || [];
    const sq = S.chatSearch || '';
    const filtered = sq ? msgs.filter(m => m.content.toLowerCase().includes(sq.toLowerCase())) : msgs;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Search bar */}
        <div className="search-bar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)', flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search this chat…" value={sq} onChange={e => update({ chatSearch: e.target.value })} />
          {sq && <button onClick={() => update({ chatSearch: '' })} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>}
          {sq && <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>}
        </div>

        {/* Messages */}
        <div className="msgs" ref={msgsRef}>
          {(sq ? filtered : msgs).map((m, i) => (
            <ChatBubble key={i} message={m} index={i} searchQuery={sq || undefined}
              onCopy={i => { navigator.clipboard?.writeText(msgs[i].content); toast('Copied!', 'success'); }}
              onToFlashcards={msgToFC}
              onToNote={msgToNote}
              onToSummarizer={msgToSum}
            />
          ))}
          {!sq && S.loadingChat && <TypingLoader />}
          {sq && filtered.length === 0 && (
            <div className="empty"><div className="empty-ico">🔍</div><div className="empty-t">No results</div><div className="empty-s">No messages match &quot;{sq}&quot;</div></div>
          )}
        </div>

        {/* Input area */}
        <div className="iarea">
          <div className="mode-strip">
            {Object.entries(MODES).map(([k, v]) => (
              <button key={k} className={`mpill${S.mode === k ? '' : ' off'}`}
                style={S.mode === k ? { background: v.g } : {}}
                onClick={() => update({ mode: k })} title={`${k} mode`}>
                {v.i} {v.l}
              </button>
            ))}
            <div className="vsep" />
            <div className="qps">
              {QPS.map(p => <button key={p} className="qp" onClick={() => setInp(p)}>{p}</button>)}
            </div>
          </div>

          {S.attachFile && (
            <div className="attach-preview">
              {S.attachPreview
                ? <img src={S.attachPreview} alt="attachment" />
                : <span style={{ fontSize: 20 }}>
                    {S.attachFile.name.toLowerCase().endsWith('.pdf') ? '📄'
                      : (S.attachFile.name.toLowerCase().endsWith('.doc') || S.attachFile.name.toLowerCase().endsWith('.docx')) ? '📝'
                      : '📃'}
                  </span>
              }
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {S.attachFile.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>
                {(S.attachFile.size / 1024).toFixed(0)}KB
              </span>
              <button onClick={() => update({ attachFile: null, attachPreview: null })}>✕</button>
            </div>
          )}

          <div className="ibox">
            <label className="att-wrap" title="Attach file">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              <input type="file" accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: 'none' }}
                onChange={e => handleAtt(e.target as HTMLInputElement)} />
            </label>
            <textarea
              id="ci" rows={1}
              placeholder="Ask anything… (Shift+Enter for new line)"
              onInput={e => { const el = e.target as HTMLTextAreaElement; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 110) + 'px'; }}
              onKeyDown={handleKey}
            />
            <button
              className={`send-btn ${S.loadingChat ? 'off' : 'on'}`}
              onClick={sendMsg}
              title="Send (Enter)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22,2 15,22 11,13 2,9"/>
              </svg>
            </button>
          </div>
          <div className="disc">StudyAI can make mistakes — always verify important facts</div>
        </div>
      </div>
    );
  }

  function renderPomodoro() {
    const p = S.pom;
    const rem = pomRemaining(S);
    const total = pomTotalSecs(S);
    const pct = p.elapsed / total;
    const R = 110;
    const circ = 2 * Math.PI * R;
    const offset = circ * (1 - Math.max(0, Math.min(1, pct)));
    const phaseColor = p.phase === 'work' ? '#7c5af0' : p.phase === 'short' ? '#10b981' : '#22d3ee';
    const phaseBg    = p.phase === 'work' ? 'rgba(124,90,240,.08)' : p.phase === 'short' ? 'rgba(16,185,129,.08)' : 'rgba(34,211,238,.08)';
    const sessionsToLong = p.target - (p.sessions % p.target);
    const phaseName = p.phase === 'work' ? 'Focus' : p.phase === 'short' ? 'Short Break' : 'Long Break';

    return (
      <div className="panel fade-up" style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div className="ph" style={{ marginBottom: 20 }}>
          <div className="pi" style={{ background: 'rgba(124,90,240,.12)' }}>⏱️</div>
          <div><div className="ptitle">Pomodoro Timer</div><div className="psub">Focus sessions with structured breaks</div></div>
          <button className="aib" style={{ marginLeft: 'auto' }}
            onClick={() => { if (Notification.permission !== 'granted') Notification.requestPermission().then(() => toast('Notifications enabled!', 'success')); }}
            title="Enable notifications">🔔</button>
        </div>

        {/* Phase tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28, background: 'var(--bg3)', padding: 5, borderRadius: 12, border: '1px solid var(--cardb)' }}>
          {([['work','Focus','#7c5af0'],['short','Short Break','#10b981'],['long','Long Break','#22d3ee']] as [string,string,string][]).map(([ph,lbl,col]) => (
            <button key={ph} onClick={() => pomSetPhase(ph as 'work'|'short'|'long')}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', transition: '.18s',
                background: p.phase === ph ? col : 'transparent',
                color: p.phase === ph ? '#fff' : 'var(--text3)',
                boxShadow: p.phase === ph ? '0 2px 8px rgba(0,0,0,.18)' : 'none' }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Timer card — ring + time stacked, no overlap */}
        <div style={{
          background: phaseBg, border: `1px solid ${phaseColor}33`,
          borderRadius: 20, padding: '32px 24px 28px', marginBottom: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        }}>
          {/* SVG ring — purely decorative progress arc */}
          <div style={{ position: 'relative', width: 260, height: 260, flexShrink: 0 }}>
            <svg viewBox="0 0 260 260" width="260" height="260" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="130" cy="130" r={R} fill="none" stroke="var(--cardb)" strokeWidth="10" />
              <circle id="pomRingFg" cx="130" cy="130" r={R} fill="none"
                stroke={phaseColor} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset .8s ease, stroke .4s' }}
              />
            </svg>
            {/* Time display centered inside ring */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <div id="pomTime" style={{
                fontSize: 52, fontWeight: 900, letterSpacing: -2, lineHeight: 1,
                color: phaseColor, fontVariantNumeric: 'tabular-nums',
              }}>{pomFmt(rem)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: phaseColor, opacity: .7 }}>
                {phaseName}
              </div>
            </div>
          </div>

          {/* Label input — below ring, no overlap */}
          <input
            className="pom-label-inp"
            style={{ width: '100%', maxWidth: 300, textAlign: 'center', fontSize: 13 }}
            value={p.label}
            placeholder="What are you focusing on?"
            onChange={e => update({ pom: { ...p, label: e.target.value } })}
          />

          {/* Session dots */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {Array(p.target).fill(0).map((_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%', transition: '.3s',
                  background: i < (p.sessions % p.target) ? phaseColor : 'var(--cardb)',
                  boxShadow: i < (p.sessions % p.target) ? `0 0 6px ${phaseColor}88` : 'none',
                }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              {sessionsToLong === p.target
                ? 'Start your first session'
                : `${sessionsToLong} session${sessionsToLong !== 1 ? 's' : ''} until long break`}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={pomReset} style={{
              width: 46, height: 46, borderRadius: '50%', border: '1px solid var(--cardb)',
              background: 'var(--bg3)', color: 'var(--text2)', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '.15s',
            }} title="Reset">⟳</button>

            <button onClick={p.running ? pomPause : pomStart} style={{
              width: 68, height: 68, borderRadius: '50%', border: 'none',
              background: phaseColor, color: '#fff', fontSize: 26, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 20px ${phaseColor}55`, transition: '.15s',
            }} title={p.running ? 'Pause' : 'Start'}>
              {p.running ? '⏸' : '▶'}
            </button>

            <button onClick={pomSkip} style={{
              width: 46, height: 46, borderRadius: '50%', border: '1px solid var(--cardb)',
              background: 'var(--bg3)', color: 'var(--text2)', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '.15s',
            }} title="Skip">⏭</button>
          </div>
        </div>

        {/* Timer Settings */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.05em' }}>Timer Settings</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            {(
              [
                ['Focus',       'workMins',  [15,20,25,30,45,60]],
                ['Short Break', 'shortMins', [3,5,8,10,15]      ],
                ['Long Break',  'longMins',  [10,15,20,25,30]   ],
              ] as [string, 'workMins' | 'shortMins' | 'longMins', number[]][]
            ).map(([lbl, key, opts]) => (
              <div key={key}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>{lbl}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {opts.map(n => (
                    <button key={n}
                      className={`bp${p[key] === n ? ' sel' : ''}`}
                      style={{ fontSize: 12, padding: '6px 0', textAlign: 'center' }}
                      onClick={() => update({ pom: { ...p, [key]: n, elapsed: 0, running: false } })}>
                      {n}m
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session history */}
        {p.history?.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Recent Sessions</div>
            {p.history.slice(0, 5).map((h, i) => (
              <div key={i} className="pom-hist-row">
                <span style={{ fontSize: 16 }}>{h.phase === 'work' ? '🎯' : '☕'}</span>
                <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>{h.label || phaseName}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 8, border: '1px solid var(--cardb)' }}>{h.mins}m</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderProgress() {
    const st = S.stats;
    const activity = st.activity || Array(14).fill(0);
    const maxA = Math.max(...activity, 1);
    const tagCounts: Record<string, number> = {};
    S.notes.forEach(n => { tagCounts[n.tag] = (tagCounts[n.tag] || 0) + 1; });
    const breakdown = [
      { lbl: 'Chats', val: S.chats.length, col: '#7c5af0' },
      { lbl: 'Cards', val: S.flashcards.length, col: '#22d3ee' },
      { lbl: 'Quizzes', val: st.totalQuizzes || 0, col: '#10b981' },
      { lbl: 'Notes', val: S.notes.length, col: '#f59e0b' },
    ];
    const maxB = Math.max(...breakdown.map(b => b.val), 1);
    const cardMastery = S.flashcards.length ? Math.round(S.fcMastered.size / S.flashcards.length * 100) : 0;

    function getMotivation() {
      const streak = st.streak || 1;
      if (streak >= 7) return `🔥 ${streak}-day streak! You're unstoppable.`;
      if (streak >= 3) return `⚡ ${streak} days in a row — great momentum!`;
      if ((st.totalQuizzes || 0) >= 10) return `🧠 ${st.totalQuizzes} quizzes completed — knowledge is building!`;
      if (S.notes.length >= 5) return `📝 ${S.notes.length} notes written — your knowledge base is growing!`;
      return `🚀 Every expert was once a beginner. Keep studying!`;
    }

    return (
      <div className="panel fade-up">
        <div className="ph">
          <div className="pi" style={{ background: 'rgba(124,90,240,.12)' }}>📊</div>
          <div><div className="ptitle">Progress</div><div className="psub">Analytics, streaks & study insights</div></div>
        </div>

        {/* Stat cards */}
        <div className="prog-grid sg">
          {[
            ['🔥', st.streak || 1, 'Day Streak', 'var(--amber)'],
            ['💬', S.chats.length, 'Chats', 'var(--violet2)'],
            ['🃏', S.flashcards.length, 'Flashcards', 'var(--cyan)'],
            ['🧠', st.totalQuizzes || 0, 'Quizzes', 'var(--green)'],
            ['📝', S.notes.length, 'Notes', 'var(--amber)'],
            ['✅', st.cardsStudied || 0, 'Cards Studied', 'var(--green)'],
          ].map(([ico, val, lbl, col]) => (
            <div key={lbl as string} className="prog-stat">
              <div className="prog-stat-ico">{ico}</div>
              <div className="prog-stat-val" style={{ color: col as string }}>{val as number}</div>
              <div className="prog-stat-lbl">{lbl}</div>
            </div>
          ))}
        </div>

        {/* Activity heatmap */}
        <div className="card sg">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 12 }}>Study Activity — Last 14 Days</div>
          <div className="heatmap">
            {activity.map((v, i) => {
              const intensity = v === 0 ? 0 : Math.max(.15, v / maxA);
              const isToday = i === 13;
              return (
                <div key={i} className="hm-cell"
                  style={{ background: v === 0 ? 'var(--cardb)' : `rgba(124,90,240,${intensity})`, outline: isToday ? '2px solid var(--violet)' : 'none', outlineOffset: 1 }}
                  title={`${isToday ? 'Today' : i === 12 ? 'Yesterday' : (13 - i) + ' days ago'}: ${v} session${v !== 1 ? 's' : ''}`}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text4)' }}>14 days ago</span>
            <span style={{ fontSize: 9, color: 'var(--text4)' }}>Today</span>
          </div>
        </div>

        {/* Tool usage & note categories */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 12 }}>Tool Usage</div>
            {breakdown.map(b => (
              <div key={b.lbl} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>{b.lbl}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: b.col }}>{b.val}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--cardb)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: b.col, width: `${b.val ? Math.round(b.val / maxB * 100) : 0}%`, transition: 'width .5s' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 12 }}>Note Categories</div>
            {Object.keys(tagCounts).length === 0 ? (
              <div className="empty" style={{ padding: '16px 0' }}><div className="empty-s">No notes yet</div></div>
            ) : Object.entries(tagCounts).map(([tag, count]) => {
              const col = NOTE_TAG_COLS[tag] || '#7c5af0';
              const pct = Math.round(count / (S.notes.length || 1) * 100);
              return (
                <div key={tag} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'capitalize' }}>{tag}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--cardb)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: col, width: `${pct}%`, transition: 'width .5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Flashcard deck */}
        {S.flashcards.length > 0 && (
          <div className="card sg">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>Current Flashcard Deck</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{S.fcTopic || 'Untitled deck'}</div>
                <div className="pbar"><div className="pfill" style={{ width: `${cardMastery}%` }} /></div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{S.fcMastered.size} of {S.flashcards.length} mastered</div>
              </div>
              <button className="aib violet" onClick={() => setTool('flashcards')}>Study Now →</button>
            </div>
          </div>
        )}

        {/* Motivational footer */}
        <div style={{ textAlign: 'center', padding: '16px 0 4px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{getMotivation()}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Keep going — consistency beats intensity.</div>
        </div>
      </div>
    );
  }

  function renderSettings() {
    const se = S.settings || {};
    return (
      <div className="panel fade-up">
        <div className="ph">
          <div className="pi" style={{ background: 'rgba(124,90,240,.12)' }}>⚙️</div>
          <div><div className="ptitle">Settings</div><div className="psub">Preferences, shortcuts, and data</div></div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: '.06em' }}>Appearance</div>
        <div className="settings-grid sg">
          <div className="set-row">
            <div><div className="set-label">Dark Mode</div><div className="set-sub">Switch between dark and light theme</div></div>
            <button className={`toggle${S.darkMode ? ' on' : ' off'}`} onClick={() => update({ darkMode: !S.darkMode })} />
          </div>
          <div className="set-row">
            <div><div className="set-label">Compact Mode</div><div className="set-sub">Reduce spacing and padding</div></div>
            <button className={`toggle${se.compactMode ? ' on' : ' off'}`} onClick={() => update({ settings: { ...se, compactMode: !se.compactMode } })} />
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: '.06em' }}>Chat</div>
        <div className="settings-grid sg">
          <div className="set-row">
            <div><div className="set-label">Send on Enter</div><div className="set-sub">Press Enter to send (Shift+Enter for new line)</div></div>
            <button className={`toggle${se.sendOnEnter !== false ? ' on' : ' off'}`} onClick={() => update({ settings: { ...se, sendOnEnter: !se.sendOnEnter } })} />
          </div>
          <div className="set-row">
            <div><div className="set-label">Auto-save Notes</div><div className="set-sub">Save notes automatically as you type</div></div>
            <button className={`toggle${se.autoSave !== false ? ' on' : ' off'}`} onClick={() => update({ settings: { ...se, autoSave: !se.autoSave } })} />
          </div>
          <div className="set-row">
            <div><div className="set-label">Default Mode</div><div className="set-sub">Mode used when starting a new chat</div></div>
            <select className="set-select" value={se.defaultMode || 'quick'}
              onChange={e => update({ settings: { ...se, defaultMode: e.target.value }, mode: e.target.value })}>
              {Object.entries(MODES).map(([k, v]) => (
                <option key={k} value={k}>{v.i} {v.l}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: '.06em' }}>Keyboard Shortcuts</div>
        <div className="shortcuts-grid sg">
          {SHORTCUTS.map(([action, ...keys]) => (
            <div key={action} className="sc-row">
              <span className="sc-action">{action}</span>
              <div className="sc-keys">{keys.filter(Boolean).map(k => <span key={k} className="sc-key">{k}</span>)}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: '.06em' }}>Data</div>
        <div className="settings-grid">
          <div className="set-row">
            <div><div className="set-label">Export All Data</div><div className="set-sub">Download your notes, chats, and plans as JSON</div></div>
            <button className="aib" onClick={() => {
              const d = { notes: S.notes, chats: S.chats, plans: S.plans, flashcards: S.flashcards, stats: S.stats, exportedAt: new Date().toISOString() };
              const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
              const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `studyai-export-${Date.now()}.json`; a.click(); URL.revokeObjectURL(u);
              toast('Data exported!', 'success');
            }}>⬇ Export</button>
          </div>
          <div className="set-row">
            <div><div className="set-label">Clear All Data</div><div className="set-sub" style={{ color: 'var(--rose)' }}>Permanently delete everything</div></div>
            <button className="aib red" onClick={() => { if (confirm('Clear ALL data? This cannot be undone.')) { localStorage.removeItem('sai3'); location.reload(); } }}>🗑 Clear</button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text4)', textAlign: 'center', marginTop: 16 }}>StudyAI v3.0 · Built with ❤️ and Claude AI</div>
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────────

  const toolObj = TOOLS.find(t => t.id === S.tool);

  return (
    <div className="app">
      <AnimatedBackground />
      <div className={`toast${toastVisible ? ' show' : ''}${toastType ? ` ${toastType}` : ''}`}>{toastMsg}</div>

      <Navbar
        S={S}
        onToggleSidebar={() => {
          // On mobile: toggle drawer open/close
          // On desktop: toggle collapsed/expanded
          if (window.innerWidth <= 640) {
            update({ mobileOpen: !S.mobileOpen });
          } else {
            update({ sidebarCollapsed: !S.sidebarCollapsed, mobileOpen: false });
          }
        }}
        onToggleTheme={() => update({ darkMode: !S.darkMode })}
        onSetTool={setTool}
        onSearch={() => setTool('chat')}
        pomBadgeTime={pomBadgeTime}
        onPomBadgeClick={() => setTool('pomodoro')}
      />

      <div className="main">
        <div className={`overlay${S.mobileOpen ? ' show' : ''}`} onClick={() => update({ mobileOpen: false })} />

        {/* Sidebar */}
        <aside className={`sidebar${S.mobileOpen ? ' open' : ''}${S.sidebarCollapsed ? ' collapsed' : ''}`}>
          <div className="sb-sec">
            <div className="sb-label">Study Tools</div>
            {TOOLS.map(t => {
              const badge = t.id === 'notes' && S.notes.length ? S.notes.length
                : t.id === 'flashcards' && S.flashcards.length ? S.flashcards.length
                : null;
              return (
                <button key={t.id} className={`tool-btn${S.tool === t.id ? ' on' : ''}`} onClick={() => setTool(t.id)}>
                  <span className="t-ico">{t.e}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-name">{t.n}</div>
                    <div className="t-desc">{t.d}</div>
                  </div>
                  {badge !== null && <span className="t-badge">{badge}</span>}
                </button>
              );
            })}
          </div>

          <div className="sb-sec">
            <button className="new-chat" onClick={addNewChat} title="New Chat">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span className="new-chat-label">New Chat</span>
            </button>
          </div>

          {S.stats.streak >= 2 && (
            <div className="streak-card">
              <div style={{ fontSize: 22 }}>🔥</div>
              <div>
                <div className="streak-num">{S.stats.streak}</div>
                <div className="streak-label">day streak</div>
                <div className="streak-sub">Keep it up!</div>
              </div>
            </div>
          )}

          <div className="sb-history">
          <div className="sb-label" style={{ padding: '7px 14px 2px' }}>History</div>
          <div className="chat-list">
            <ChatList
              chats={S.chats}
              activeChatId={S.activeChatId}
              activeTool={S.tool}
              onSelect={selChat}
              onRename={renameChat}
              onStar={starChat}
              onArchive={archiveChat}
              onDuplicate={duplicateChat}
              onDelete={delChat}
              onColor={colorChat}
            />
          </div>
          </div>{/* /sb-history */}

          <div className="sb-sec" style={{ marginTop: 'auto' }}>
            <button className="tool-btn" onClick={() => setTool('settings')}>
              <span className="t-ico">⚙️</span>
              <div><div className="t-name">Settings</div><div className="t-desc">Preferences & shortcuts</div></div>
            </button>
          </div>
        </aside>

        {/* Content */}
        <section className="content">
          {S.tool === 'dashboard'  && renderDashboard()}
          {S.tool === 'chat'       && renderChat()}
          {S.tool === 'flashcards' && (
            <FlashcardPanel S={S} onUpdate={update} onSave={() => saveState(S)} onToast={toast} />
          )}
          {S.tool === 'quiz' && (
            <QuizPanel S={S} onUpdate={update} onSave={() => saveState(S)} onToast={toast} />
          )}
          {S.tool === 'notes' && (
            <NotesPanel S={S} onUpdate={update} onSave={() => saveState(S)} onToast={toast} />
          )}
          {S.tool === 'summarizer' && (
            <SummarizerPanel S={S} onUpdate={update} onSave={() => saveState(S)} onToast={toast} onSetTool={setTool} />
          )}
          {S.tool === 'planner' && (
            <PlannerPanel S={S} onUpdate={update} onSave={() => saveState(S)} onToast={toast} />
          )}
          {S.tool === 'media' && (
            <MediaLibrary S={S} onUpdate={update} onSave={() => saveState(S)} onToast={toast} onSetTool={setTool} />
          )}
          {S.tool === 'pomodoro'  && renderPomodoro()}
          {S.tool === 'progress'  && renderProgress()}
          {S.tool === 'settings'  && renderSettings()}
        </section>
      </div>
    </div>
  );
}
