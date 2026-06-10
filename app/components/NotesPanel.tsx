"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, StickyNote, Plus, Trash2, FileText, Eye, Edit3, Search, Tag, X } from "lucide-react";

type Note = { id: string; title: string; body: string; created: string; tag?: string };
type NotesPanelProps = { onSendToChat: (text: string) => void };
type AIAction = "summarize" | "improve" | "bullet" | "quiz" | "expand";

const NOTE_TAGS = [
  { label: "📚 Study",    value: "study",    color: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
  { label: "📝 Lecture",  value: "lecture",  color: "text-blue-400   border-blue-500/30   bg-blue-500/10"   },
  { label: "💡 Ideas",    value: "ideas",    color: "text-amber-400  border-amber-500/30  bg-amber-500/10"  },
  { label: "✅ Todo",     value: "todo",     color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { label: "🔬 Research", value: "research", color: "text-cyan-400   border-cyan-500/30   bg-cyan-500/10"   },
];

function getTagColor(tag?: string) {
  return NOTE_TAGS.find((t) => t.value === tag)?.color ?? "text-gray-400 border-white/10 bg-white/5";
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong class='text-white font-semibold'>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em class='text-gray-300'>$1</em>")
    .replace(/`(.*?)`/g, "<code class='bg-white/10 text-cyan-300 px-1.5 py-0.5 rounded text-xs font-mono'>$1</code>")
    .replace(/^###\s+(.+)$/gm, "<h3 class='text-base font-bold text-white mt-4 mb-1.5 flex items-center gap-2'><span class='w-1 h-4 rounded-full bg-violet-400/60 inline-block'></span>$1</h3>")
    .replace(/^##\s+(.+)$/gm,  "<h2 class='text-lg font-bold text-white mt-5 mb-2 flex items-center gap-2'><span class='w-1 h-5 rounded-full bg-linear-to-b from-violet-400 to-cyan-400 inline-block'></span>$1</h2>")
    .replace(/^#\s+(.+)$/gm,   "<h1 class='text-xl font-bold text-white mt-5 mb-2'>$1</h1>")
    .replace(/^[\-\*•]\s+(.+)$/gm, "<li class='ml-4 list-disc text-gray-200 leading-7'>$1</li>")
    .replace(/^\d+\.\s+(.+)$/gm,   "<li class='ml-4 list-decimal text-gray-200 leading-7'>$1</li>")
    .replace(/(<li[\s\S]*?<\/li>\n?)+/g, (m) => `<ul class='my-2 space-y-1 pl-1'>${m}</ul>`)
    .replace(/\n\n+/g, "</p><p class='mb-2.5 leading-7 text-gray-200'>")
    .replace(/\n/g, "<br/>");
}

export default function NotesPanel({ onSendToChat }: NotesPanelProps) {
  const [notes,         setNotes]         = useState<Note[]>([]);
  const [activeId,      setActiveId]      = useState<string | null>(null);
  const [title,         setTitle]         = useState("");
  const [body,          setBody]          = useState("");
  const [tag,           setTag]           = useState<string>("");
  const [loading,       setLoading]       = useState(false);
  const [loadingAction, setLoadingAction] = useState<AIAction | null>(null);
  const [showList,      setShowList]      = useState(true);
  const [previewMode,   setPreviewMode]   = useState(false);
  const [search,        setSearch]        = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("studyai-notes");
    if (saved) {
      const parsed: Note[] = JSON.parse(saved);
      setNotes(parsed);
      if (parsed.length > 0) loadNote(parsed[0]);
    }
  }, []);

  // Pick up notes sent from chat
  useEffect(() => {
    const raw = localStorage.getItem("studyai-new-note");
    if (!raw) return;
    localStorage.removeItem("studyai-new-note");
    try {
      const { title: t, body: b } = JSON.parse(raw);
      const note: Note = {
        id: Date.now().toString(),
        title: t || "AI Response",
        body: b || "",
        created: new Date().toLocaleDateString(),
        tag: "study",
      };
      setNotes((prev) => {
        const updated = [note, ...prev];
        localStorage.setItem("studyai-notes", JSON.stringify(updated));
        return updated;
      });
      loadNote(note);
    } catch { /* ignore */ }
  });

  // Close tag picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node))
        setShowTagPicker(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function saveToStorage(updated: Note[]) {
    localStorage.setItem("studyai-notes", JSON.stringify(updated));
  }

  function loadNote(note: Note) {
    setActiveId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setTag(note.tag || "");
    setPreviewMode(false);
    setShowTagPicker(false);
    if (window.innerWidth < 768) setShowList(false);
  }

  function newNote() {
    const note: Note = {
      id: Date.now().toString(),
      title: "Untitled Note",
      body: "",
      created: new Date().toLocaleDateString(),
      tag: "",
    };
    const updated = [note, ...notes];
    setNotes(updated);
    saveToStorage(updated);
    loadNote(note);
  }

  function saveCurrentNote(newTitle?: string, newBody?: string, newTag?: string) {
    if (!activeId) return;
    const t = newTitle !== undefined ? newTitle : title;
    const b = newBody  !== undefined ? newBody  : body;
    const g = newTag   !== undefined ? newTag   : tag;
    const updated = notes.map((n) =>
      n.id === activeId ? { ...n, title: t || "Untitled", body: b, tag: g } : n
    );
    setNotes(updated);
    saveToStorage(updated);
  }

  function deleteNote() {
    if (!activeId) return;
    const updated = notes.filter((n) => n.id !== activeId);
    setNotes(updated);
    saveToStorage(updated);
    if (updated.length > 0) loadNote(updated[0]);
    else { setActiveId(null); setTitle(""); setBody(""); setTag(""); setShowList(true); }
  }

  async function aiAction(action: AIAction) {
    if (!body.trim()) return;
    setLoading(true);
    setLoadingAction(action);
    try {
      const res  = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "note_action", payload: { body, action } }),
      });
      const data = await res.json();
      if (data.text) {
        setBody(data.text);
        saveCurrentNote(title, data.text, tag);
        if (action === "bullet" || action === "summarize" || action === "quiz") setPreviewMode(true);
      }
    } catch { /* silent */ }
    setLoading(false);
    setLoadingAction(null);
  }

  const wordCount     = body.trim() ? body.trim().split(/\s+/).length : 0;
  const activeNote    = notes.find((n) => n.id === activeId);
  const filteredNotes = search.trim()
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.body.toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  const AI_ACTIONS: { action: AIAction; icon: string; label: string; hover: string }[] = [
    { action: "summarize", icon: "⚡", label: "Summarize", hover: "hover:bg-amber-500/10  hover:border-amber-500/30  hover:text-amber-300"  },
    { action: "improve",   icon: "✨", label: "Improve",   hover: "hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-violet-300" },
    { action: "bullet",    icon: "•",  label: "Bullets",   hover: "hover:bg-cyan-500/10   hover:border-cyan-500/30   hover:text-cyan-300"   },
    { action: "quiz",      icon: "❓", label: "Quiz Me",   hover: "hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300" },
    { action: "expand",    icon: "📖", label: "Expand",    hover: "hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-300" },
  ];

  const loadingLabels: Record<AIAction, string> = {
    summarize: "summarizing",
    improve:   "improving",
    bullet:    "converting to bullets",
    quiz:      "generating quiz questions",
    expand:    "expanding your notes",
  };

  return (
    <div className="flex flex-1 overflow-hidden w-full">

      {/* ── NOTES SIDEBAR ── */}
      <div className={`flex flex-col border-r border-white/8 bg-black/20
        ${showList ? "flex" : "hidden md:flex"}
        w-full md:w-64 shrink-0`}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <StickyNote size={14} className="text-amber-400" />
            </div>
            <span className="text-sm font-bold text-white">My Notes</span>
            <span className="text-[11px] text-[#9a9ab8] bg-white/5 px-2 py-0.5 rounded-full">{notes.length}</span>
          </div>
          <button onClick={newNote}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold transition-all">
            <Plus size={12} /> New
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-white/5">
          <div className="flex items-center gap-2 px-3 py-2 bg-white/4 border border-white/9 rounded-xl focus-within:border-amber-500/40 transition-colors">
            <Search size={13} className="text-[#9a9ab8] shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="flex-1 bg-transparent text-xs text-white placeholder:text-[#5a5a7a] outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[#9a9ab8] hover:text-white transition-colors">
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center p-8 h-full">
              <div className="text-4xl">📝</div>
              <div className="text-sm font-semibold text-white">{search ? "No results" : "No notes yet"}</div>
              <div className="text-xs text-[#9a9ab8]">{search ? "Try a different search" : "Click New to create your first note"}</div>
              {!search && (
                <button onClick={newNote} className="mt-1 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold transition-all">
                  + Create Note
                </button>
              )}
            </div>
          ) : (
            filteredNotes.map((n) => (
              <div key={n.id} onClick={() => loadNote(n)}
                className={`px-4 py-3.5 cursor-pointer border-b border-white/5 transition-all
                  ${n.id === activeId ? "bg-amber-500/10 border-l-2 border-l-amber-500" : "hover:bg-white/5 border-l-2 border-l-transparent"}`}>
                <div className="flex items-start gap-2">
                  <FileText size={13} className={`mt-0.5 shrink-0 ${n.id === activeId ? "text-amber-400" : "text-[#5a5a7a]"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-white truncate">{n.title || "Untitled"}</span>
                    </div>
                    {n.tag && (
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border mb-1 ${getTagColor(n.tag)}`}>
                        {NOTE_TAGS.find((t) => t.value === n.tag)?.label ?? n.tag}
                      </span>
                    )}
                    <div className="text-[11px] text-[#9a9ab8] truncate leading-relaxed">{n.body?.slice(0, 50) || "Empty note…"}</div>
                    <div className="text-[10px] text-[#5a5a7a] mt-1">{n.created}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── EDITOR AREA ── */}
      <div className={`flex flex-col flex-1 overflow-hidden ${!showList ? "flex" : "hidden md:flex"}`}>
        {activeId ? (
          <>
            {/* Topbar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-black/10 shrink-0 flex-wrap gap-y-2">
              <button onClick={() => setShowList(true)}
                className="md:hidden p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                ←
              </button>

              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); saveCurrentNote(e.target.value, body, tag); }}
                placeholder="Note title…"
                className="flex-1 min-w-0 bg-transparent text-white text-base font-bold outline-none placeholder:text-[#5a5a7a]"
              />

              {/* Tag picker */}
              <div ref={tagPickerRef} className="relative shrink-0">
                <button
                  onClick={() => setShowTagPicker((v) => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all
                    ${tag ? getTagColor(tag) : "bg-white/4 border-white/9 text-gray-400 hover:text-white"}`}
                >
                  <Tag size={11} />
                  {tag ? NOTE_TAGS.find((t) => t.value === tag)?.label ?? tag : "Tag"}
                </button>
                {showTagPicker && (
                  <div className="absolute right-0 top-9 z-50 bg-[#0f0f1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-36">
                    {tag && (
                      <button onClick={() => { setTag(""); saveCurrentNote(title, body, ""); setShowTagPicker(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:bg-white/5 border-b border-white/5 transition-colors">
                        <X size={10} /> Remove tag
                      </button>
                    )}
                    {NOTE_TAGS.map((t) => (
                      <button key={t.value} onClick={() => { setTag(t.value); saveCurrentNote(title, body, t.value); setShowTagPicker(false); }}
                        className={`flex items-center gap-2 w-full px-3 py-2.5 text-xs font-medium transition-colors hover:bg-white/5
                          ${tag === t.value ? t.color : "text-gray-300"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-[11px] text-[#5a5a7a] shrink-0 hidden sm:block">{wordCount} words</span>

              {/* Preview / Edit toggle */}
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all shrink-0
                  ${previewMode
                    ? "bg-amber-500/20 border-amber-500/30 text-amber-300"
                    : "bg-white/4 border-white/9 text-gray-400 hover:text-white"}`}
              >
                {previewMode ? <Edit3 size={12} /> : <Eye size={12} />}
                <span className="hidden sm:inline">{previewMode ? "Edit" : "Preview"}</span>
              </button>
            </div>

            {/* Body */}
            {previewMode ? (
              <div
                className="flex-1 overflow-y-auto px-6 py-5 text-sm text-gray-200 leading-7 cursor-text"
                onClick={() => setPreviewMode(false)}
              >
                {body.trim() ? (
                  <div
                    className="prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:text-gray-200 [&_strong]:text-white [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: `<p class='mb-2.5 leading-7 text-gray-200'>${renderMarkdown(body)}</p>` }}
                  />
                ) : (
                  <p className="text-[#5a5a7a] italic">Nothing to preview yet. Switch to Edit to start writing.</p>
                )}
                <p className="text-[10px] text-[#5a5a7a] mt-6">Click anywhere to edit</p>
              </div>
            ) : (
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); saveCurrentNote(title, e.target.value, tag); }}
                placeholder={"Start writing your notes here…\n\nMarkdown supported:\n- **bold**, *italic*, `code`\n- # Heading 1, ## Heading 2\n- - bullet points\n\nUse the AI toolbar below to enhance your notes."}
                className="flex-1 bg-transparent text-gray-200 text-sm px-6 py-5 outline-none resize-none leading-7 placeholder:text-[#5a5a7a] font-mono"
              />
            )}

            {/* AI Toolbar */}
            <div className="shrink-0 border-t border-white/8 bg-black/20 px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-[#5a5a7a] uppercase tracking-widest font-bold mr-1 hidden sm:block">AI</span>

                {AI_ACTIONS.map(({ action, icon, label, hover }) => (
                  <button key={action} onClick={() => aiAction(action)} disabled={loading || !body.trim()}
                    className={`flex items-center gap-1.5 px-3 py-2 bg-white/4 border border-white/9 text-gray-300 rounded-xl text-xs font-medium transition-all disabled:opacity-40 ${hover}`}>
                    {loadingAction === action ? <Loader2 size={11} className="animate-spin" /> : icon}
                    {label}
                  </button>
                ))}

                <button
                  onClick={() => onSendToChat(`Based on these study notes, what are the most important concepts I should focus on?\n\n${body}`)}
                  disabled={!body.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 rounded-xl text-xs font-medium transition-all disabled:opacity-40">
                  💬 Ask AI
                </button>

                <button onClick={deleteNote}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium transition-all ml-auto">
                  <Trash2 size={11} /> Delete
                </button>
              </div>

              {loading && (
                <div className="flex items-center gap-2 mt-2 text-xs text-amber-400">
                  <Loader2 size={11} className="animate-spin" />
                  AI is {loadingLabels[loadingAction!]}…
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <StickyNote size={32} className="text-amber-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-white mb-1">No note selected</div>
              <div className="text-sm text-gray-400 max-w-xs">Select a note from the list or create a new one.</div>
            </div>
            <button onClick={newNote}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl text-sm font-semibold transition-all">
              <Plus size={15} /> Create New Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}