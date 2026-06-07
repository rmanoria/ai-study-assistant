"use client";

import { useState, useEffect } from "react";
import { Loader2, StickyNote, Plus, Trash2, FileText, Eye, Edit3 } from "lucide-react";

type Note = { id: string; title: string; body: string; created: string };
type NotesPanelProps = { onSendToChat: (text: string) => void };

// Minimal markdown renderer for notes preview
function renderMarkdown(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Bullet points: lines starting with - or * or •
    .replace(/^[\-\*•]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Headings
    .replace(/^###\s+(.+)$/gm, '<h3 class="text-base font-bold text-white mt-3 mb-1">$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2 class="text-lg font-bold text-white mt-4 mb-1">$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1 class="text-xl font-bold text-white mt-4 mb-2">$1</h1>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li[\s\S]*?<\/li>(\n|$))+/g, (match) => `<ul class="my-2 space-y-1">${match}</ul>`)
    // Line breaks (double newline = paragraph)
    .replace(/\n\n+/g, '</p><p class="mb-2">')
    // Single newlines
    .replace(/\n/g, "<br/>");
}

export default function NotesPanel({ onSendToChat }: NotesPanelProps) {
  const [notes, setNotes]               = useState<Note[]>([]);
  const [activeId, setActiveId]         = useState<string | null>(null);
  const [title, setTitle]               = useState("");
  const [body, setBody]                 = useState("");
  const [loading, setLoading]           = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showList, setShowList]         = useState(true);
  const [previewMode, setPreviewMode]   = useState(false);

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
      const note: Note = { id: Date.now().toString(), title: t || "AI Response", body: b || "", created: new Date().toLocaleDateString() };
      setNotes((prev) => {
        const updated = [note, ...prev];
        localStorage.setItem("studyai-notes", JSON.stringify(updated));
        return updated;
      });
      loadNote(note);
    } catch { /* ignore */ }
  });

  function saveToStorage(updated: Note[]) {
    localStorage.setItem("studyai-notes", JSON.stringify(updated));
  }

  function loadNote(note: Note) {
    setActiveId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setPreviewMode(false);
    if (window.innerWidth < 768) setShowList(false);
  }

  function newNote() {
    const note: Note = { id: Date.now().toString(), title: "Untitled Note", body: "", created: new Date().toLocaleDateString() };
    const updated = [note, ...notes];
    setNotes(updated);
    saveToStorage(updated);
    loadNote(note);
  }

  function saveCurrentNote(newTitle?: string, newBody?: string) {
    if (!activeId) return;
    const t = newTitle !== undefined ? newTitle : title;
    const b = newBody !== undefined ? newBody : body;
    const updated = notes.map((n) => n.id === activeId ? { ...n, title: t || "Untitled", body: b } : n);
    setNotes(updated);
    saveToStorage(updated);
  }

  function deleteNote() {
    if (!activeId) return;
    const updated = notes.filter((n) => n.id !== activeId);
    setNotes(updated);
    saveToStorage(updated);
    if (updated.length > 0) loadNote(updated[0]);
    else { setActiveId(null); setTitle(""); setBody(""); setShowList(true); }
  }

  async function aiAction(action: "summarize" | "improve" | "bullet") {
    if (!body.trim()) return;
    setLoading(true);
    setLoadingAction(action);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "note_action", payload: { body, action } }),
      });
      const data = await res.json();
      if (data.text) {
        setBody(data.text);
        saveCurrentNote(title, data.text);
        // Auto-switch to preview so bullets render properly
        if (action === "bullet" || action === "summarize") setPreviewMode(true);
      }
    } catch { /* silent */ }
    setLoading(false);
    setLoadingAction(null);
  }

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-1 overflow-hidden w-full">

      {/* ── NOTES SIDEBAR LIST ── */}
      <div className={`flex flex-col border-r border-white/8 bg-black/20
        ${showList ? "flex" : "hidden md:flex"}
        w-full md:w-64 shrink-0`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <StickyNote size={14} className="text-amber-400" />
            </div>
            <span className="text-sm font-bold text-white">My Notes</span>
            <span className="text-[11px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{notes.length}</span>
          </div>
          <button onClick={newNote}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold transition-all">
            <Plus size={12} /> New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center p-8 h-full">
              <div className="text-4xl">📝</div>
              <div className="text-sm font-semibold text-white">No notes yet</div>
              <div className="text-xs text-gray-500">Click New to create your first note</div>
              <button onClick={newNote} className="mt-1 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold transition-all">
                + Create Note
              </button>
            </div>
          ) : (
            notes.map((n) => (
              <div key={n.id} onClick={() => loadNote(n)}
                className={`px-4 py-3.5 cursor-pointer border-b border-white/5 transition-all
                  ${n.id === activeId ? "bg-amber-500/10 border-l-2 border-l-amber-500" : "hover:bg-white/5 border-l-2 border-l-transparent"}`}>
                <div className="flex items-start gap-2">
                  <FileText size={13} className={`mt-0.5 shrink-0 ${n.id === activeId ? "text-amber-400" : "text-gray-600"}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{n.title || "Untitled"}</div>
                    <div className="text-[11px] text-gray-500 truncate mt-0.5 leading-relaxed">{n.body?.slice(0, 55) || "Empty note…"}</div>
                    <div className="text-[10px] text-gray-600 mt-1">{n.created}</div>
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
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-black/10 shrink-0">
              <button onClick={() => setShowList(true)}
                className="md:hidden p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                ←
              </button>
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); saveCurrentNote(e.target.value, body); }}
                placeholder="Note title…"
                className="flex-1 min-w-0 bg-transparent text-white text-base font-bold outline-none placeholder:text-gray-600 truncate"
              />
              <span className="text-[11px] text-gray-600 shrink-0 hidden sm:block">{wordCount} words</span>

              {/* Preview / Edit toggle */}
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all shrink-0
                  ${previewMode
                    ? "bg-amber-500/20 border-amber-500/30 text-amber-300"
                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white"}`}
                title={previewMode ? "Switch to edit" : "Preview rendered"}
              >
                {previewMode ? <Edit3 size={12} /> : <Eye size={12} />}
                <span className="hidden sm:inline">{previewMode ? "Edit" : "Preview"}</span>
              </button>
            </div>

            {/* Body: edit or preview */}
            {previewMode ? (
              <div
                className="flex-1 overflow-y-auto px-6 py-5 text-sm text-gray-200 leading-7"
                onClick={() => setPreviewMode(false)}
              >
                {body.trim() ? (
                  <div
                    className="prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:text-gray-200 [&_strong]:text-white [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${renderMarkdown(body)}</p>` }}
                  />
                ) : (
                  <p className="text-gray-600 italic">Nothing to preview yet. Switch to Edit to start writing.</p>
                )}
                <p className="text-[10px] text-gray-600 mt-4">Tap anywhere to edit</p>
              </div>
            ) : (
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); saveCurrentNote(title, e.target.value); }}
                placeholder={"Start writing your notes here…\n\nTips:\n- Use the AI toolbar below\n- Use **bold**, *italic*, or - bullets\n- Click Preview to see rendered output"}
                className="flex-1 bg-transparent text-gray-200 text-sm px-6 py-5 outline-none resize-none leading-7 placeholder:text-gray-600 font-mono"
              />
            )}

            {/* AI Toolbar */}
            <div className="shrink-0 border-t border-white/8 bg-black/20 px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mr-1 hidden sm:block">AI</span>

                {[
                  { action: "summarize" as const, icon: "⚡", label: "Summarize", hover: "hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-300" },
                  { action: "improve"   as const, icon: "✨", label: "Improve",   hover: "hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-violet-300" },
                  { action: "bullet"    as const, icon: "•",  label: "Bullets",   hover: "hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-300" },
                ].map(({ action, icon, label, hover }) => (
                  <button key={action} onClick={() => aiAction(action)} disabled={loading || !body.trim()}
                    className={`flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 text-gray-300 rounded-xl text-xs font-medium transition-all disabled:opacity-40 ${hover}`}>
                    {loadingAction === action ? <Loader2 size={11} className="animate-spin" /> : icon}
                    {label}
                  </button>
                ))}

                <button onClick={() => onSendToChat(`Based on these study notes, what are the most important concepts I should focus on?\n\n${body}`)}
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
                  AI is {loadingAction === "summarize" ? "summarizing" : loadingAction === "improve" ? "improving" : "converting to bullets"}…
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
