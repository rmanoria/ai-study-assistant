'use client';

import { AppState, Note, uid, md2html } from '../types';

interface SummarizerPanelProps {
  S: AppState;
  onUpdate: (patch: Partial<AppState>) => void;
  onSave: () => void;
  onToast: (msg: string, type?: string) => void;
  onSetTool: (id: string) => void;
}

// ─── Extract PDF text in the browser using PDF.js (CDN, no npm needed) ────────
async function extractPdfInBrowser(file: File): Promise<string> {
  // Dynamically load PDF.js from CDN if not already loaded
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PDF.js'));
      document.head.appendChild(script);
    });
    // Set worker
    (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const pdfjsLib = (window as any).pdfjsLib;

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) textParts.push(pageText);
  }

  return textParts.join('\n\n');
}

export default function SummarizerPanel({ S, onUpdate, onSave, onToast, onSetTool }: SummarizerPanelProps) {

  // ─── Read file and extract text ─────────────────────────────────────────────
  async function procFile(file: File) {
    if (file.size > 10 * 1024 * 1024) return onToast('File exceeds 10MB limit', 'error');

    const n = file.name.toLowerCase();
    const type = n.endsWith('.pdf') ? 'pdf'
      : n.endsWith('.docx') || n.endsWith('.doc') ? 'docx'
      : n.endsWith('.txt') || n.endsWith('.md') ? 'txt'
      : file.type.startsWith('image/') ? 'image'
      : null;

    if (!type) return onToast('Unsupported file type (PDF, Word, TXT, image)', 'error');

    onUpdate({ sumFileName: file.name, sumFileType: type, sumFileText: '', sumResult: '' });
    onToast('Reading file…');

    try {
      let extractedText = '';

      if (type === 'txt') {
        extractedText = await file.text();

      } else if (type === 'image') {
        const dataUrl = await readAsDataURL(file);
        extractedText = `[IMAGE:${dataUrl}]`;

      } else if (type === 'pdf') {
        // ✅ Use browser-side PDF.js — reliable for all PDF types
        onToast('Parsing PDF…');
        extractedText = await extractPdfInBrowser(file);

        if (!extractedText || extractedText.trim().length < 30) {
          onToast('Could not extract text — PDF may be scanned. Try pasting the text directly.', 'error');
          onUpdate({ sumFileName: '', sumFileType: '', sumFileText: '' });
          return;
        }

      } else if (type === 'docx' || type === 'doc') {
        const dataUrl = await readAsDataURL(file);
        const base64  = dataUrl.split(',')[1];

        const res = await fetch('/api/tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'extract_docx', payload: { base64 } }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        extractedText = d.text || '';
      }

      if (!extractedText.trim() && type !== 'image') {
        onToast('Could not extract text — try pasting the content directly', 'error');
        onUpdate({ sumFileName: '', sumFileType: '', sumFileText: '' });
        return;
      }

      onUpdate({ sumFileText: extractedText });
      onToast(`✓ ${file.name} ready`, 'success');

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to read file';
      onToast(msg, 'error');
      onUpdate({ sumFileName: '', sumFileType: '', sumFileText: '' });
    }
  }

  function readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = e => resolve(e.target?.result as string);
      r.onerror = () => reject(new Error('Could not read file'));
      r.readAsDataURL(file);
    });
  }

  // ─── Summarize ─────────────────────────────────────────────────────────────
  async function doSum() {
    const textEl    = document.getElementById('sumTextArea') as HTMLTextAreaElement;
    const pastedTxt = textEl?.value?.trim() || S.sumInputText?.trim() || '';
    const fileTxt   = S.sumFileText?.trim() || '';
    const raw       = fileTxt || pastedTxt;

    if (!raw) return onToast('Upload a file or paste some text first', 'error');

    const isImage = raw.startsWith('[IMAGE:');

    onUpdate({ loadingTool: true, sumResult: '' });
    try {
      const r = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'summarize',
          payload: {
            text: isImage ? raw : raw.slice(0, 8000),
            style: S.sumStyle,
            level: S.sumLevel,
            isImage,
          },
        }),
      });
      const d = await r.json();
      onUpdate({ sumResult: d.text || d.error || 'Failed to summarize.', loadingTool: false });
      onSave();
    } catch {
      onUpdate({ sumResult: '⚠️ Connection error — check your API configuration.', loadingTool: false });
    }
  }

  function sumToNote() {
    if (!S.sumResult) return;
    const n: Note = {
      id: uid(),
      title: 'Summary — ' + new Date().toLocaleDateString(),
      body: S.sumResult,
      created: new Date().toLocaleDateString(),
      tag: 'summary',
    };
    const notes = [n, ...S.notes];
    onUpdate({ notes, activeNoteId: n.id, stats: { ...S.stats, totalNotes: notes.length } });
    onSetTool('notes');
    onSave();
    onToast('Saved to Notes!', 'success');
  }

  const fileTypeIcons: Record<string, string> = { pdf: '📄', docx: '📝', doc: '📝', txt: '📃', image: '🖼️' };
  const fileText   = S.sumFileText?.trim() || '';
  const hasContent = !!(fileText || S.sumInputText?.trim());
  const charCount  = fileText.startsWith('[IMAGE:') ? 0 : fileText.length;

  return (
    <div className="sum-layout">
      {/* ── Left: controls ── */}
      <div className="sum-left">
        <div className="ph">
          <div className="pi" style={{ background: 'rgba(16,185,129,.12)' }}>⚡</div>
          <div><div className="ptitle">AI Summarizer</div><div className="psub">PDF, Word, TXT, images & more</div></div>
        </div>

        {/* Style */}
        <div className="sg">
          <div className="flbl">Summary style</div>
          <div className="bgrp">
            {[['concise','📌 Concise'],['bullets','• Bullets'],['academic','🎓 Academic'],
              ['eli5','🧒 ELI5'],['mindmap','🗺 Concepts'],['outline','📋 Outline']].map(([v,l]) => (
              <button key={v} className={`bp${S.sumStyle === v ? ' sel' : ''}`}
                onClick={() => onUpdate({ sumStyle: v })}>{l}</button>
            ))}
          </div>
        </div>

        {/* Level */}
        <div className="sg">
          <div className="flbl">Audience level</div>
          <div className="bgrp">
            {[['elementary','🧒 Elementary'],['highschool','🏫 High School'],
              ['undergraduate','🎓 University'],['graduate','🔬 Graduate']].map(([v,l]) => (
              <button key={v} className={`bp${S.sumLevel === v ? ' sel' : ''}`}
                onClick={() => onUpdate({ sumLevel: v })}>{l}</button>
            ))}
          </div>
        </div>

        {/* File upload */}
        {!S.sumFileName ? (
          <div
            className="dropzone sg"
            onClick={() => document.getElementById('sumf')?.click()}
            onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('drag'); }}
            onDragLeave={e => (e.currentTarget as HTMLElement).classList.remove('drag')}
            onDrop={e => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).classList.remove('drag');
              const f = e.dataTransfer.files?.[0];
              if (f) procFile(f);
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 7 }}>📂</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Drop a file or click to upload</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>PDF, Word, TXT, images (max 10MB)</div>
            <input type="file" id="sumf" accept=".pdf,.doc,.docx,.txt,.md,image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) procFile(f); e.target.value = ''; }} />
          </div>
        ) : (
          <div className="file-pill sg">
            <span style={{ fontSize: 20 }}>{fileTypeIcons[S.sumFileType] || '📄'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {S.sumFileName}
              </div>
              {fileText ? (
                <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 2 }}>
                  {fileText.startsWith('[IMAGE:')
                    ? '✓ Image ready for AI vision'
                    : `✓ ${charCount.toLocaleString()} characters extracted`}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 2 }}>⟳ Extracting text…</div>
              )}
            </div>
            <button onClick={() => onUpdate({ sumFileName: '', sumFileText: '', sumFileType: '' })}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        )}

        <div className="or-div">
          <div className="or-line" /><span className="or-txt">or paste text</span><div className="or-line" />
        </div>

        <textarea className="fi sg" rows={7} id="sumTextArea"
          placeholder="Paste lecture notes, article text, or any content…"
          defaultValue={S.sumInputText}
          onChange={e => onUpdate({ sumInputText: e.target.value })} />

        <button className="pbtn" onClick={doSum} disabled={S.loadingTool || !hasContent}>
          {S.loadingTool ? <><span className="spinning">⟳</span> Summarizing…</> : '⚡ Summarize'}
        </button>

        {charCount > 8000 && (
          <div style={{ fontSize: 10, color: 'var(--amber)', textAlign: 'center', marginTop: 6 }}>
            ⚠️ File is large — first 8,000 characters will be used. Paste a key section for better results.
          </div>
        )}
      </div>

      {/* ── Right: result ── */}
      <div className="sum-right">
        {S.loadingTool ? (
          <div className="empty">
            <div style={{ fontSize: 28, marginBottom: 8 }}><span className="spinning">⟳</span></div>
            <div className="empty-t">Summarizing…</div>
            <div className="empty-s">AI is reading and distilling your content.</div>
          </div>
        ) : S.sumResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 7, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Summary · {S.sumStyle}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="aib green" onClick={() => { navigator.clipboard?.writeText(S.sumResult); onToast('Copied!', 'success'); }}>📋 Copy</button>
                <button className="aib" onClick={() => {
                  const b = new Blob([S.sumResult], { type: 'text/markdown' });
                  const u = URL.createObjectURL(b);
                  const a = document.createElement('a');
                  a.href = u; a.download = `summary-${Date.now()}.md`; a.click();
                  URL.revokeObjectURL(u);
                }}>⬇ .md</button>
                <button className="aib" onClick={sumToNote}>📝 Save Note</button>
                <button className="aib red" onClick={() => onUpdate({ sumResult: '' })}>Clear</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--cardb)', borderRadius: 'var(--radius)', padding: 14 }}>
              <div className="md" dangerouslySetInnerHTML={{ __html: md2html(S.sumResult) }} />
            </div>
          </div>
        ) : (
          <div className="empty">
            <div className="empty-ico">⚡</div>
            <div className="empty-t">Summary appears here</div>
            <div className="empty-s">Upload a document or paste text, pick a style, then summarize.</div>
          </div>
        )}
      </div>
    </div>
  );
}
