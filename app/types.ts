// ─── Core Types ───────────────────────────────────────────────────────────────

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'pdf' | 'doc' | 'txt';
  imgData?: string;
  ts?: number;
};

export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  created: number;
};

export type Flashcard = {
  q: string;
  a: string;
  tag?: string;
  hint?: string;
};

export type QuizQuestion = {
  type: 'mcq' | 'tf' | 'short';
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  created: string;
  tag: string;
};

export type PlanTask = {
  id: string;
  text: string;
  done: boolean;
  priority?: 'high' | 'medium' | 'low';
  due?: string;
};

export type PlanSubject = {
  id: string;
  name: string;
  color: string;
  tasks: PlanTask[];
};

export type Plan = {
  id: string;
  name: string;
  subjects: PlanSubject[];
  created: string;
};

export type MediaItem = {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'doc' | 'txt';
  size: number;
  dataUrl: string;
  addedAt: string;
};

export type PomHistory = {
  phase: string;
  label: string;
  mins: number;
  ts: number;
};

export type AppStats = {
  totalChats: number;
  totalCards: number;
  totalQuizzes: number;
  totalNotes: number;
  quizzesPassed: number;
  cardsStudied: number;
  streak: number;
  activity: number[];
};

export type AppSettings = {
  soundEnabled: boolean;
  autoSave: boolean;
  compactMode: boolean;
  defaultMode: string;
  fontSize: string;
  sendOnEnter: boolean;
};

export type PomState = {
  running: boolean;
  phase: 'work' | 'short' | 'long';
  elapsed: number;
  sessions: number;
  workMins: number;
  shortMins: number;
  longMins: number;
  target: number;
  history: PomHistory[];
  label: string;
};

export type ToolId =
  | 'dashboard' | 'chat' | 'flashcards' | 'quiz'
  | 'notes' | 'summarizer' | 'planner' | 'pomodoro'
  | 'progress' | 'media' | 'settings';

export type AppState = {
  tool: ToolId;
  mode: string;
  darkMode: boolean;
  chats: Chat[];
  activeChatId: string | null;
  loadingChat: boolean;
  attachFile: File | null;
  attachPreview: string | null;
  notes: Note[];
  activeNoteId: string | null;
  noteLoadAction: string | null;
  plans: Plan[];
  activePlanId: string | null;
  expandedSubjects: Set<string>;
  flashcards: Flashcard[];
  fcTopic: string;
  fcInstruction: string;
  fcDiff: string;
  fcCount: number;
  fcView: 'setup' | 'grid' | 'study' | 'results';
  fcFlipped: Set<number>;
  fcMastered: Set<number>;
  fcStudyIdx: number;
  fcStudyFlipped: boolean;
  fcError: string;
  quizPhase: 'setup' | 'active' | 'result';
  questions: QuizQuestion[];
  quizIdx: number;
  quizScore: number;
  wrongIdxs: number[];
  selectedMCQ: number | null;
  selectedTF: boolean | null;
  saInput: string;
  saResult: string | null;
  showExplain: boolean;
  qzTopic: string;
  qzType: string;
  qzDiff: string;
  qzCount: number;
  qzError: string;
  sumStyle: string;
  sumLevel: string;
  sumInputText: string;
  sumFileName: string;
  sumFileType: string;
  sumFileText: string;
  sumResult: string;
  mediaItems: MediaItem[];
  mobileOpen: boolean;
  loadingTool: boolean;
  stats: AppStats;
  settings: AppSettings;
  pom: PomState;
  notesPreview: boolean;
  chatSearch: string;
  lastVisit?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const TOOLS = [
  { id: 'dashboard',  e: '🏠', n: 'Dashboard',   d: 'Overview & progress' },
  { id: 'chat',       e: '💬', n: 'Chat',         d: 'AI academic tutor' },
  { id: 'flashcards', e: '🃏', n: 'Flashcards',   d: 'AI study cards' },
  { id: 'quiz',       e: '🧠', n: 'Quiz',         d: 'Test your knowledge' },
  { id: 'notes',      e: '📝', n: 'Notes',        d: 'Smart note-taking' },
  { id: 'summarizer', e: '⚡', n: 'Summarizer',   d: 'Analyse documents' },
  { id: 'planner',    e: '📅', n: 'Planner',      d: 'Study schedules' },
  { id: 'pomodoro',   e: '⏱️', n: 'Pomodoro',     d: 'Focus timer & sessions' },
  { id: 'progress',   e: '📊', n: 'Progress',     d: 'Analytics & streaks' },
  { id: 'media',      e: '🖼️', n: 'Media',        d: 'Files & images' },
] as const;

export const MODES: Record<string, { l: string; i: string; g: string }> = {
  quick:    { l: 'Quick',    i: '⚡', g: 'linear-gradient(135deg,#7c5af0,#5b3fc0)' },
  deep:     { l: 'Deep',     i: '🧠', g: 'linear-gradient(135deg,#6d28d9,#4c1d95)' },
  research: { l: 'Research', i: '🔬', g: 'linear-gradient(135deg,#059669,#047857)' },
  socratic: { l: 'Socratic', i: '💭', g: 'linear-gradient(135deg,#dc2626,#991b1b)' },
};

export const QPS = ['Explain this', 'Show examples', 'Key points', 'Help me outline', 'Quiz me'];

export const COLORS = ['#6c63ff','#10b981','#f59e0b','#ec4899','#22d3ee','#f97316','#8b5cf6','#06b6d4'];

export const NOTE_TAGS = [
  { id: 'study',    l: 'Study',    c: '#7c5af0' },
  { id: 'summary',  l: 'Summary',  c: '#10b981' },
  { id: 'idea',     l: 'Idea',     c: '#f59e0b' },
  { id: 'todo',     l: 'To-Do',    c: '#ec4899' },
  { id: 'question', l: 'Question', c: '#22d3ee' },
];

export const NOTE_TAG_COLS: Record<string, string> = {
  study: '#7c5af0', summary: '#10b981', idea: '#f59e0b', todo: '#ec4899', question: '#22d3ee',
};

export const SHORTCUTS: [string, ...string[]][] = [
  ['New Chat','Ctrl','N'],
  ['Search','Ctrl','K'],
  ['Send message','Enter'],
  ['Toggle theme','Ctrl','D'],
  ['Switch to Chat','Ctrl','1'],
  ['Flashcards','Ctrl','2'],
  ['Quiz','Ctrl','3'],
  ['Notes','Ctrl','4'],
  ['Summarizer','Ctrl','5'],
  ['Planner','Ctrl','6'],
];

// ─── Utilities ────────────────────────────────────────────────────────────────

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mkChat(): Chat {
  return {
    id: uid(),
    title: 'New Chat',
    messages: [{
      role: 'assistant',
      content: '## Welcome to StudyAI ✦\n\nYour personal AI tutor — ready for **any subject** at any depth.\n\n**Modes:**\n- ⚡ **Quick** — direct, concise answers\n- 🧠 **Deep** — thorough explanations with examples\n- 🔬 **Research** — graduate-level depth with web context\n- 💭 **Socratic** — learn by discovery, guided by questions\n\n**Attach images** of textbooks or handwritten notes — I can read and analyse them.\n\nPick a mode and ask me anything. 🚀',
      ts: Date.now(),
    }],
    created: Date.now(),
  };
}

export function md2html(raw: string): string {
  if (!raw) return '';
  let s = String(raw);
  s = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => `<pre><code>${code.trim()}</code></pre>`);
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  s = s.replace(/^---$/gm, '<hr>');
  s = s.replace(/((?:^[-*•] .+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[-*•] /, '').trim()}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  s = s.replace(/((?:^\d+\. .+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '').trim()}</li>`).join('');
    return `<ol>${items}</ol>`;
  });
  s = s.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
  s = '<p>' + s + '</p>';
  s = s.replace(/<p>\s*<\/p>/g, '').replace(/<p>(<[huo])/g, '$1').replace(/(<\/[huo][l1-6]>)<\/p>/g, '$1');
  return s;
}

// ─── Default State ────────────────────────────────────────────────────────────

export function getDefaultState(): AppState {
  const c = mkChat();
  return {
    tool: 'dashboard',
    mode: 'quick',
    darkMode: true,
    chats: [c],
    activeChatId: c.id,
    loadingChat: false,
    attachFile: null,
    attachPreview: null,
    notes: [],
    activeNoteId: null,
    noteLoadAction: null,
    plans: [],
    activePlanId: null,
    expandedSubjects: new Set(),
    flashcards: [],
    fcTopic: '',
    fcInstruction: '',
    fcDiff: 'medium',
    fcCount: 10,
    fcView: 'setup',
    fcFlipped: new Set(),
    fcMastered: new Set(),
    fcStudyIdx: 0,
    fcStudyFlipped: false,
    fcError: '',
    quizPhase: 'setup',
    questions: [],
    quizIdx: 0,
    quizScore: 0,
    wrongIdxs: [],
    selectedMCQ: null,
    selectedTF: null,
    saInput: '',
    saResult: null,
    showExplain: false,
    qzTopic: '',
    qzType: 'mcq',
    qzDiff: 'medium',
    qzCount: 8,
    qzError: '',
    sumStyle: 'concise',
    sumLevel: 'undergraduate',
    sumInputText: '',
    sumFileName: '',
    sumFileType: '',
    sumFileText: '',
    sumResult: '',
    mediaItems: [],
    mobileOpen: false,
    loadingTool: false,
    stats: {
      totalChats: 0, totalCards: 0, totalQuizzes: 0, totalNotes: 0,
      quizzesPassed: 0, cardsStudied: 0, streak: 1,
      activity: Array(14).fill(0),
    },
    settings: {
      soundEnabled: false, autoSave: true, compactMode: false,
      defaultMode: 'quick', fontSize: 'normal', sendOnEnter: true,
    },
    pom: {
      running: false, phase: 'work', elapsed: 0, sessions: 0,
      workMins: 25, shortMins: 5, longMins: 15, target: 4,
      history: [], label: '',
    },
    notesPreview: false,
    chatSearch: '',
  };
}
