'use client';

import { useState, useRef, useEffect } from 'react';
import { Chat, ToolId } from '../types';

interface ChatListProps {
  chats: Chat[];
  activeChatId: string | null;
  activeTool: ToolId;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onStar: (id: string) => void;
  onArchive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onColor: (id: string, color: string) => void;
}

const CHAT_COLORS = [
  { hex: '', label: 'Default' },
  { hex: '#7c5af0', label: 'Purple' },
  { hex: '#22d3ee', label: 'Cyan' },
  { hex: '#10b981', label: 'Green' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#f43f5e', label: 'Rose' },
  { hex: '#6366f1', label: 'Indigo' },
];

interface MenuState {
  id: string;
  x: number;
  y: number;
}

export default function ChatList({
  chats, activeChatId, activeTool, onSelect,
  onRename, onStar, onArchive, onDuplicate, onDelete, onColor,
}: ChatListProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menu) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menu]);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingId]);

  function openMenu(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).closest('.ci')?.getBoundingClientRect();
    if (!rect) return;
    // Position menu below the item, clamped to viewport
    const menuH = 280;
    const y = rect.bottom + window.scrollY;
    const clampedY = y + menuH > window.innerHeight ? rect.top - menuH + window.scrollY : y;
    setMenu({ id, x: rect.left, y: clampedY });
  }

  function startRename(id: string, currentTitle: string) {
    setMenu(null);
    setRenamingId(id);
    setRenameVal(currentTitle);
  }

  function commitRename(id: string) {
    if (renameVal.trim()) onRename(id, renameVal.trim());
    setRenamingId(null);
  }

  const activeChats = chats.filter(c => !c.archived).slice(0, 30);
  const archivedChats = chats.filter(c => c.archived);
  const starredChats = activeChats.filter(c => c.starred);
  const regularChats = activeChats.filter(c => !c.starred);

  function renderChat(c: Chat) {
    const isActive = c.id === activeChatId && activeTool === 'chat';
    const isRenaming = renamingId === c.id;
    const dotColor = c.color || 'transparent';

    return (
      <div
        key={c.id}
        className={`ci${isActive ? ' on' : ''}`}
        onClick={() => !isRenaming && onSelect(c.id)}
        style={{ position: 'relative' }}
      >
        {/* Color dot */}
        {c.color && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: dotColor,
            flexShrink: 0, display: 'inline-block', marginRight: 2,
          }} />
        )}

        {/* Chat icon */}
        {!c.color && (
          <svg className="ci-ico" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}

        {/* Title or rename input */}
        {isRenaming ? (
          <input
            ref={renameRef}
            className="ci-rename-inp"
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={() => commitRename(c.id)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename(c.id);
              if (e.key === 'Escape') setRenamingId(null);
              e.stopPropagation();
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="ci-title">
            {c.starred && <span style={{ marginRight: 3, fontSize: 9 }}>⭐</span>}
            {c.archived && <span style={{ marginRight: 3, fontSize: 9 }}>📦</span>}
            {c.title}
          </span>
        )}

        {/* Three-dot menu button */}
        {!isRenaming && (
          <button
            className="ci-menu-btn"
            onClick={e => openMenu(e, c.id)}
            title="Chat options"
            aria-label="Chat options"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
        )}
      </div>
    );
  }

  const menuChat = menu ? chats.find(c => c.id === menu.id) : null;

  return (
    <>
      {/* Starred section */}
      {starredChats.length > 0 && (
        <>
          <div className="ci-section-label">⭐ Starred</div>
          {starredChats.map(renderChat)}
        </>
      )}

      {/* Regular chats */}
      {starredChats.length > 0 && regularChats.length > 0 && (
        <div className="ci-section-label">Recent</div>
      )}
      {regularChats.map(renderChat)}

      {/* Archived toggle */}
      {archivedChats.length > 0 && (
        <>
          <button
            className="ci-archive-toggle"
            onClick={() => setShowArchived(v => !v)}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: showArchived ? 'rotate(90deg)' : 'none', transition: '.15s' }}>
              <polyline points="9,18 15,12 9,6"/>
            </svg>
            📦 Archived ({archivedChats.length})
          </button>
          {showArchived && archivedChats.map(renderChat)}
        </>
      )}

      {/* Context menu portal */}
      {menu && menuChat && (
        <div
          ref={menuRef}
          className="chat-ctx-menu"
          style={{ top: menu.y, left: menu.x }}
          onClick={e => e.stopPropagation()}
        >
          {/* Rename */}
          <button className="ctx-item" onClick={() => startRename(menu.id, menuChat.title)}>
            <span className="ctx-ico">✏️</span> Rename
          </button>

          {/* Star */}
          <button className="ctx-item" onClick={() => { onStar(menu.id); setMenu(null); }}>
            <span className="ctx-ico">{menuChat.starred ? '★' : '☆'}</span>
            {menuChat.starred ? 'Unstar' : 'Star'}
          </button>

          {/* Archive */}
          <button className="ctx-item" onClick={() => { onArchive(menu.id); setMenu(null); }}>
            <span className="ctx-ico">📦</span>
            {menuChat.archived ? 'Unarchive' : 'Archive'}
          </button>

          {/* Duplicate */}
          <button className="ctx-item" onClick={() => { onDuplicate(menu.id); setMenu(null); }}>
            <span className="ctx-ico">📋</span> Duplicate
          </button>

          {/* Color picker */}
          <div className="ctx-divider" />
          <div className="ctx-label">Color label</div>
          <div className="ctx-colors">
            {CHAT_COLORS.map(col => (
              <button
                key={col.hex}
                className={`ctx-color-dot${menuChat.color === col.hex ? ' active' : ''}`}
                title={col.label}
                style={{ background: col.hex || 'var(--cardb)', border: col.hex ? `2px solid ${col.hex}` : '2px solid var(--border2)' }}
                onClick={() => { onColor(menu.id, col.hex); setMenu(null); }}
              />
            ))}
          </div>

          <div className="ctx-divider" />

          {/* Export */}
          <button className="ctx-item" onClick={() => {
            const c = menuChat;
            const text = c.messages.map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n\n');
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${c.title}.txt`; a.click();
            URL.revokeObjectURL(url);
            setMenu(null);
          }}>
            <span className="ctx-ico">⬇️</span> Export as TXT
          </button>

          <div className="ctx-divider" />

          {/* Delete */}
          <button className="ctx-item danger" onClick={() => {
            setMenu(null);
            if (confirm(`Delete "${menuChat.title}"?`)) onDelete(menu.id);
          }}>
            <span className="ctx-ico">🗑️</span> Delete
          </button>
        </div>
      )}
    </>
  );
}
