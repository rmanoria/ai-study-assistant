'use client';

import { AppState, MediaItem, uid } from '../types';

interface MediaLibraryProps {
  S: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onSave: () => void;
  onToast: (msg: string, type?: string) => void;
  onSetTool: (id: string) => void;
}

export default function MediaLibrary({ S, onUpdate, onSave, onToast, onSetTool }: MediaLibraryProps) {
  const items = S.mediaItems || [];

  function addMedia(files: FileList) {
    Array.from(files).forEach(file => {
      if (file.size > 15 * 1024 * 1024) return onToast(`${file.name} exceeds 15MB`, 'error');
      const r = new FileReader();
      r.onload = e => {
        const n = file.name.toLowerCase();
        const type: MediaItem['type'] = file.type.startsWith('image/') ? 'image' : n.endsWith('.pdf') ? 'pdf' : n.endsWith('.docx') || n.endsWith('.doc') ? 'doc' : 'txt';
        const item: MediaItem = {
          id: uid(), name: file.name, type, size: file.size,
          dataUrl: e.target?.result as string,
          addedAt: new Date().toLocaleDateString(),
        };
        onUpdate({ mediaItems: [item, ...(S.mediaItems || [])] });
        onSave();
      };
      r.readAsDataURL(file);
    });
    onToast('Uploading…');
  }

  function dlMedia(id: string) {
    const it = items.find(i => i.id === id);
    if (!it) return;
    const a = document.createElement('a');
    a.href = it.dataUrl; a.download = it.name; a.click();
  }

  function rmMedia(id: string) {
    onUpdate({ mediaItems: items.filter(i => i.id !== id) });
    onSave();
  }

  function useInChat(id: string) {
    const it = items.find(i => i.id === id);
    if (!it) return;
    onUpdate({ attachPreview: it.type === 'image' ? it.dataUrl : null });
    onSetTool('chat');
    onToast(`${it.name} ready to send`, 'success');
  }

  const totalSize = items.reduce((a, i) => a + (i.size || 0), 0);
  const fmtSize = totalSize > 1024 * 1024 ? `${(totalSize / 1024 / 1024).toFixed(1)} MB` : `${Math.round(totalSize / 1024)} KB`;

  return (
    <div className="panel fade-up">
      <div className="ph">
        <div className="pi" style={{ background: 'rgba(124,90,240,.12)' }}>🖼️</div>
        <div><div className="ptitle">Media Library</div><div className="psub">Images, PDFs, and documents</div></div>
        {items.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{items.length} files · {fmtSize}</span>
            <button className="aib red" onClick={() => { if (confirm('Clear all media?')) { onUpdate({ mediaItems: [] }); onSave(); } }}>
              Clear All
            </button>
          </div>
        )}
      </div>

      <div
        className="dropzone"
        style={{ marginBottom: 16 }}
        onClick={() => document.getElementById('mfinp')?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (e.dataTransfer.files) addMedia(e.dataTransfer.files); }}
      >
        <div style={{ fontSize: 20, marginBottom: 7 }}>⬆️</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Drop files or click to upload</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Images, PDF, Word, TXT — up to 15MB each</div>
        <input type="file" id="mfinp" multiple accept="image/*,.pdf,.doc,.docx,.txt" style={{ display: 'none' }}
          onChange={e => { if (e.target.files) addMedia(e.target.files); e.target.value = ''; }} />
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">📂</div>
          <div className="empty-t">Library is empty</div>
          <div className="empty-s">Upload files for quick access and reuse across tools.</div>
        </div>
      ) : (
        <div className="media-grid">
          {items.map(it => (
            <div key={it.id} className="media-item">
              <div className="media-thumb">
                {it.type === 'image'
                  ? <img src={it.dataUrl} alt={it.name} loading="lazy" />
                  : { pdf: '📄', doc: '📝', txt: '📃' }[it.type] || '📄'}
              </div>
              <div className="media-info" title={it.name}>{it.name}</div>
              <div className="media-size">{it.size ? `${(it.size / 1024).toFixed(0)}KB` : ''}</div>
              <div className="media-actions">
                <button onClick={() => dlMedia(it.id)}
                  style={{ flex: 1, fontSize: 10, padding: 3, borderRadius: 4, border: '1px solid var(--cardb)', background: 'var(--card)', color: 'var(--text3)', cursor: 'pointer' }}
                  title="Download">⬇</button>
                <button onClick={() => useInChat(it.id)}
                  style={{ flex: 1, fontSize: 10, padding: 3, borderRadius: 4, border: '1px solid var(--cardb)', background: 'var(--card)', color: 'var(--text3)', cursor: 'pointer' }}
                  title="Use in chat">💬</button>
                <button onClick={() => rmMedia(it.id)}
                  style={{ fontSize: 10, padding: '3px 5px', borderRadius: 4, border: '1px solid rgba(244,63,94,.22)', background: 'rgba(244,63,94,.06)', color: 'var(--rose)', cursor: 'pointer' }}
                  title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
