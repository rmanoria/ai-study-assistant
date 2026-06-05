"use client";

import { useState, useEffect } from "react";
import { Loader2, StickyNote, Plus, Trash2, FileText } from "lucide-react";

type Note = {
  id: string;
  title: string;
  body: string;
  created: string;
};

type NotesPanelProps = {
  onSendToChat: (text: string) => void;
};

export default function NotesPanel({ onSendToChat }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("studyai-notes");
    if (saved) {
      const parsed: Note[] = JSON.parse(saved);
      setNotes(parsed);
      if (parsed.length > 0) loadNote(parsed[0]);
    }
  }, []);

  function saveToStorage(updated: Note[]) {
    localStorage.setItem("studyai-notes", JSON.stringify(updated));
  }

  function loadNote(note: Note) {
    setActiveId(note.id);
    setTitle(note.title);
    setBody(note.body);
    // On mobile, hide list when note is selected
    if (window.innerWidth < 768) setShowList(false);
  }

  function newNote() {
    const note: Note = {
      id: Date.now().toString(),
      title: "Untitled Note",
      body: "",
      created: new Date().toLocaleDateString(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    saveToStorage(updated);
    loadNote(note);
  }

  function saveCurrentNote(newTitle?: string, newBody?: string) {
    if (!activeId) return;
    const t = newTitle !== undefined ? newTitle : title;
    const b = newBody !== undefined ? newBody : body;
    const updated = notes.map((n) =>
      n.id === activeId ? { ...n, title: t || "Untitled", body: b } : n
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
      }
    } catch { /* silent */ }
    setLoading(false);
    setLoadingAction(null);
  }

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-1 overflow-hidden w-full">

      {/* ── NOTES SIDEBAR LIST ── */}
      <div className={`
        flex flex-col border-r border-white/8 bg-black/20
        ${showList ? "flex" : "hidden md:flex"}
        w-full md:w-64 shrink-0
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <StickyNote size={14} className="text-amber-400" />
            </div>
            <span className="text-sm font-bold text-white">My Notes</span>
            <span className="text-[11px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
              {notes.length}
            </span>
          </div>
          <button
            onClick={newNote}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold transition-all"
          >
            <Plus size={12} /> New
          </button>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center p-8 h-full">
              <div className="text-4xl">📝</div>
              <div className="text-sm font-semibold text-white">No notes yet</div>
              <div className="text-xs text-gray-500">Click New to create your first note</div>
              <button
                onClick={newNote}
                className="mt-1 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold transition-all"
              >
                + Create Note
              </button>
            </div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                onClick={() => loadNote(n)}
                className={`px-4 py-3.5 cursor-pointer border-b border-white/5 transition-all group
                  ${n.id === activeId
                    ? "bg-amber-500/10 border-l-2 border-l-amber-500"
                    : "hover:bg-white/5 border-l-2 border-l-transparent"
                  }`}
              >
                <div className="flex items-start gap-2">
                  <FileText size={13} className={`mt-0.5 shrink-0 ${n.id === activeId ? "text-amber-400" : "text-gray-600"}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{n.title || "Untitled"}</div>
                    <div className="text-[11px] text-gray-500 truncate mt-0.5 leading-relaxed">
                      {n.body?.slice(0, 55) || "Empty note…"}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">{n.created}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── EDITOR AREA ── */}
      <div className={`
        flex flex-col flex-1 overflow-hidden
        ${!showList ? "flex" : "hidden md:flex"}
      `}>
        {activeId ? (
          <>
            {/* Editor topbar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 bg-black/10 shrink-0">
              {/* Back button on mobile */}
              <button
                onClick={() => setShowList(true)}
                className="md:hidden p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                ← 
              </button>
              <div className="flex-1 min-w-0">
                <input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); saveCurrentNote(e.target.value, body); }}
                  placeholder="Note title…"
                  className="w-full bg-transparent text-white text-base font-bold outline-none placeholder:text-gray-600 truncate"
                />
              </div>
              <span className="text-[11px] text-gray-600 shrink-0">{wordCount} words</span>
            </div>

            {/* Textarea */}
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); saveCurrentNote(title, e.target.value); }}
              placeholder="Start writing your notes here…&#10;&#10;Tips:&#10;• Use the AI toolbar below to summarize or improve your notes&#10;• Click 'Ask AI' to send your notes to the chat"
              className="flex-1 bg-transparent text-gray-200 text-sm px-6 py-5 outline-none resize-none leading-7 placeholder:text-gray-600 font-mono"
            />

            {/* AI Toolbar */}
            <div className="shrink-0 border-t border-white/8 bg-black/20 px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mr-1 hidden sm:block">AI</span>

                <button
                  onClick={() => aiAction("summarize")}
                  disabled={loading || !body.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 text-gray-300 hover:text-amber-300 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
                >
                  {loadingAction === "summarize" ? <Loader2 size={11} className="animate-spin" /> : "⚡"}
                  Summarize
                </button>

                <button
                  onClick={() => aiAction("improve")}
                  disabled={loading || !body.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-violet-500/10 border border-white/10 hover:border-violet-500/30 text-gray-300 hover:text-violet-300 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
                >
                  {loadingAction === "improve" ? <Loader2 size={11} className="animate-spin" /> : "✨"}
                  Improve
                </button>

                <button
                  onClick={() => aiAction("bullet")}
                  disabled={loading || !body.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 text-gray-300 hover:text-cyan-300 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
                >
                  {loadingAction === "bullet" ? <Loader2 size={11} className="animate-spin" /> : "•"}
                  Bullet Points
                </button>

                <button
                  onClick={() => onSendToChat(`Based on these study notes, what are the most important concepts I should focus on?\n\n${body}`)}
                  disabled={!body.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
                >
                  💬 Ask AI
                </button>

                <button
                  onClick={deleteNote}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium transition-all ml-auto"
                >
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
          /* Empty editor state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <StickyNote size={32} className="text-amber-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-white mb-1">No note selected</div>
              <div className="text-sm text-gray-400 max-w-xs">
                Select a note from the list or create a new one to start writing.
              </div>
            </div>
            <button
              onClick={newNote}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl text-sm font-semibold transition-all"
            >
              <Plus size={15} /> Create New Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
