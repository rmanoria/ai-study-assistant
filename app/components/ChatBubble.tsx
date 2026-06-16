'use client';

import { useState } from 'react';
import { Message, md2html, esc } from '../types';

interface ChatBubbleProps {
  message: Message;
  index: number;
  searchQuery?: string;
  onCopy: (i: number) => void;
  onToFlashcards: (i: number) => void;
  onToNote: (i: number) => void;
  onToSummarizer: (i: number) => void;
}

function highlightSearch(text: string, q: string): string {
  if (!q || !text) return esc(text || '');
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return esc(text).replace(new RegExp(escaped, 'gi'), m => `<mark class="search-highlight">${m}</mark>`);
}

// File attachment pill shown above the message text
function FilePill({ fileName, fileType }: { fileName: string; fileType?: string }) {
  const icons: Record<string, string> = { image: '🖼️', pdf: '📄', doc: '📝', txt: '📃' };
  const icon = icons[fileType || 'txt'] || '📎';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 8,
      background: 'rgba(124,90,240,.10)', border: '1px solid rgba(124,90,240,.22)',
      fontSize: 11, color: 'var(--violet2)', fontWeight: 600,
      maxWidth: '100%', overflow: 'hidden',
    }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
    </div>
  );
}

export default function ChatBubble({
  message, index, searchQuery, onCopy, onToFlashcards, onToNote, onToSummarizer
}: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const timeStr = message.ts
    ? new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const displayContent = searchQuery
    ? highlightSearch(message.content, searchQuery)
    : null;

  const handleCopy = () => {
    onCopy(index);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (isUser) {
    return (
      <div className="mrow u fade-in">
        <div className="av u">👤</div>
        <div className="bub u">
          {/* Image preview */}
          {message.imgData && (
            <div className="img-attach">
              <img src={message.imgData} alt={message.fileName || 'attachment'} />
            </div>
          )}
          {/* File pill (non-image or supplemental label) */}
          {message.fileName && (
            <FilePill fileName={message.fileName} fileType={message.fileType} />
          )}
          {/* Message text — only shown if there's actual text */}
          {message.content && (
            <div
              className="bt u"
              dangerouslySetInnerHTML={{ __html: displayContent || esc(message.content) }}
            />
          )}
          {timeStr && (
            <div style={{ fontSize: 9, color: 'var(--text3)', padding: '0 2px' }}>{timeStr}</div>
          )}
        </div>
      </div>
    );
  }

  const aiBody = searchQuery
    ? (
      <div
        style={{ padding: '9px 13px', borderRadius: 13, fontSize: 13, lineHeight: 1.62, background: 'var(--card)', border: '1px solid var(--cardb)', color: 'var(--text2)' }}
        dangerouslySetInnerHTML={{ __html: displayContent || '' }}
      />
    ) : (
      <div className="bt ai">
        <div className="md" dangerouslySetInnerHTML={{ __html: md2html(message.content) }} />
      </div>
    );

  return (
    <div className="mrow fade-in">
      <div className="av ai">✦</div>
      <div className="bub">
        {aiBody}
        <div className="macts">
          <button className={`mab${copied ? ' ok' : ''}`} onClick={handleCopy}>
            {copied ? '✅ Copied' : '📋 Copy'}
          </button>
          <button className="mab" onClick={() => onToFlashcards(index)}>🃏 Cards</button>
          <button className="mab" onClick={() => onToNote(index)}>📝 Note</button>
          <button className="mab" onClick={() => onToSummarizer(index)}>⚡ Summarize</button>
          {timeStr && (
            <span style={{ fontSize: 9, color: 'var(--text4)', marginLeft: 'auto', alignSelf: 'center' }}>
              {timeStr}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
