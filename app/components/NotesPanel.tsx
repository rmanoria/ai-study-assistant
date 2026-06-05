"use client";

import { useState, useEffect } from "react";
import { Loader2, StickyNote, Plus, Trash2 } from "lucide-react";

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
    else { setActiveId(null); setTitle(""); setBody(""); }
  }

  async function aiAction(action: "summarize" | "improve" | "bullet") {
    if (!body.trim()) return;
    setLoading(true);
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
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Notes list */}
      <div className="w-52 border-r border-white/8 flex flex-col overflow-hidden shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <StickyNote size={14} className="text-amber-400" />
            <span className="text-xs font-semibold text-gray-300">Notes</span>
          </div>
          <button
            onClick={newNote}
            className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 rounded-lg transition-all"
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="p-4 text-xs text-gray-500 text-center mt-6">
              No notes yet.<br />Click + to create one.
            </div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                onClick={() => loadNote(n)}
                className={`px-4 py-3 cursor-pointer border-b border-white/5 transition-colors ${
                  n.id === activeId ? "bg-white/8" : "hover:bg-white/5"
                }`}
              >
                <div className="text-xs font-semibold text-white truncate">{n.title}</div>
                <div className="text-[11px] text-gray-500 truncate mt-0.5">
                  {n.body?.slice(0, 50) || "Empty note"}
                </div>
                <div className="text-[10px] text-gray-600 mt-1">{n.created}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {activeId ? (
          <>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); saveCurrentNote(e.target.value, body); }}
              placeholder="Note title…"
              className="bg-transparent border-b border-white/8 text-white text-lg font-bold px-6 py-4 outline-none placeholder:text-gray-600"
            />
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); saveCurrentNote(title, e.target.value); }}
              placeholder="Start writing your notes here…"
              className="flex-1 bg-transparent text-gray-200 text-sm px-6 py-4 outline-none resize-none leading-7 placeholder:text-gray-600 font-mono"
            />
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-white/8">
              <button
                onClick={() => aiAction("summarize")}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : "⚡"}
                Summarize
              </button>
              <button
                onClick={() => aiAction("improve")}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
              >
                ✨ Improve
              </button>
              <button
                onClick={() => aiAction("bullet")}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
              >
                • Bullet Points
              </button>
              <button
                onClick={() => { onSendToChat(`Based on these study notes, what are the most important concepts I should focus on?\n\n${body}`); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 rounded-lg text-xs font-medium transition-all"
              >
                💬 Ask AI
              </button>
              <button
                onClick={deleteNote}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-all ml-auto"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="text-5xl">📝</div>
            <div className="text-white font-semibold text-lg">No note selected</div>
            <div className="text-gray-400 text-sm">
              Create a new note or select one from the list.
            </div>
            <button
              onClick={newNote}
              className="mt-2 px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl text-sm font-semibold transition-all"
            >
              + New Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
