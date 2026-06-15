'use client';

import { AppState, Note, NOTE_TAGS, NOTE_TAG_COLS, uid, md2html } from '../types';

interface NotesPanelProps {
  S: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onSave: () => void;
  onToast: (msg: string, type?: string) => void;
}

export default function NotesPanel({ S, onUpdate, onSave, onToast }: NotesPanelProps) {
  const activeNote = S.notes.find(n => n.id === S.activeNoteId);

  function newNote() {
    const n: Note = { id: uid(), title: 'Untitled Note', body: '', created: new Date().toLocaleDateString(), tag: 'study' };
    const notes = [n, ...S.notes];
    onUpdate({ notes, activeNoteId: n.id, stats: { ...S.stats, totalNotes: notes.length } });
    onSave();
  }

  function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return;
    const notes = S.notes.filter(n => n.id !== id);
    const activeNoteId = S.activeNoteId === id ? (notes[0]?.id || null) : S.activeNoteId;
    onUpdate({ notes, activeNoteId, stats: { ...S.stats, totalNotes: notes.length } });
    onSave();
  }

  function updateTitle(val: string) {
    if (!activeNote) return;
    const notes = S.notes.map(n => n.id === activeNote.id ? { ...n, title: val } : n);
    onUpdate({ notes });
    if (S.settings.autoSave) onSave();
  }

  function updateBody(val: string) {
    if (!activeNote) return;
    const notes = S.notes.map(n => n.id === activeNote.id ? { ...n, body: val } : n);
    onUpdate({ notes });
    if (S.settings.autoSave) onSave();
  }

  function updateTag(tag: string) {
    if (!activeNote) return;
    const notes = S.notes.map(n => n.id === activeNote.id ? { ...n, tag } : n);
    onUpdate({ notes });
    onSave();
  }

  function exportNote() {
    if (!activeNote) return;
    const b = new Blob([`# ${activeNote.title}\n\n${activeNote.body}`], { type: 'text/markdown' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = `${activeNote.title}.md`; a.click();
    URL.revokeObjectURL(u);
    onToast('Note exported!', 'success');
  }

  return (
    <div className="notes-wrap">
      {/* Notes List */}
      <div className={`notes-list${S.mobileOpen ? ' show' : ''}`}>
        <div className="notes-list-hd">
          <span>Notes ({S.notes.length})</span>
          <button className="aib violet" onClick={newNote}>+ New</button>
        </div>
        <div className="nl-items">
          {S.notes.length === 0 && (
            <div className="empty" style={{ padding: '20px 8px' }}>
              <div className="empty-ico">📝</div>
              <div className="empty-s">No notes yet. Create one!</div>
            </div>
          )}
          {S.notes.map(n => {
            const tagCol = NOTE_TAG_COLS[n.tag] || '#7c5af0';
            return (
              <div key={n.id} className={`ni${n.id === S.activeNoteId ? ' on' : ''}`} onClick={() => onUpdate({ activeNoteId: n.id })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="ni-title">{n.title}</div>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 12, marginLeft: 4, flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); deleteNote(n.id); }}
                  >✕</button>
                </div>
                <div className="ni-meta">{n.created}</div>
                <div className="ni-tag" style={{ background: `${tagCol}22`, color: tagCol }}>{n.tag}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor */}
      {activeNote ? (
        <div className="note-editor">
          <div className="ne-toolbar">
            <input
              className="ne-title"
              value={activeNote.title}
              onChange={e => updateTitle(e.target.value)}
              placeholder="Note title…"
            />
            <div className="bgrp">
              {NOTE_TAGS.map(tag => (
                <button key={tag.id}
                  className={`bp${activeNote.tag === tag.id ? ' sel' : ''}`}
                  style={{ fontSize: 10, padding: '3px 9px' }}
                  onClick={() => updateTag(tag.id)}
                >
                  {tag.l}
                </button>
              ))}
            </div>
            <button className="aib" onClick={() => onUpdate({ notesPreview: !S.notesPreview })}>
              {S.notesPreview ? '✏️ Edit' : '👁 Preview'}
            </button>
            <button className="aib" onClick={exportNote}>⬇ .md</button>
            {S.settings.autoSave && (
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>Auto-saving…</span>
            )}
          </div>

          {S.notesPreview ? (
            <div className="ne-preview">
              <div className="md" dangerouslySetInnerHTML={{ __html: md2html(activeNote.body) }} />
            </div>
          ) : (
            <textarea
              className="ne-body"
              value={activeNote.body}
              onChange={e => updateBody(e.target.value)}
              placeholder="Start writing… Markdown is supported"
            />
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="empty">
            <div className="empty-ico">📝</div>
            <div className="empty-t">No note selected</div>
            <div className="empty-s">Select a note from the list or create a new one.</div>
            <button className="pbtn" style={{ marginTop: 12, width: 'auto', padding: '8px 20px' }} onClick={newNote}>
              + New Note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
