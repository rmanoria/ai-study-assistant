'use client';

import { AppState, TOOLS, ToolId } from '../types';
import { SignInButton, UserButton, useUser } from '@clerk/nextjs';

interface NavbarProps {
  S: AppState;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onSetTool: (id: ToolId) => void;
  onSearch: () => void;
  pomBadgeTime?: string;
  onPomBadgeClick: () => void;
}

export default function Navbar({
  S, onToggleSidebar, onToggleTheme, onSetTool, onSearch, pomBadgeTime, onPomBadgeClick
}: NavbarProps) {
  const tool = TOOLS.find(t => t.id === S.tool);
  const bcText = S.tool === 'chat'
    ? (S.chats.find(c => c.id === S.activeChatId)?.title || 'Chat')
    : (tool?.n || '');
  const isCollapsed = S.sidebarCollapsed;
  const { isSignedIn } = useUser();

  return (
    <nav className="navbar">
      {/* Hamburger / collapse toggle */}
      <button
        className={`nb sidebar-toggle${isCollapsed ? ' collapsed' : ''}`}
        onClick={onToggleSidebar}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {isCollapsed ? (
            <polyline points="9,18 15,12 9,6" />
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </>
          )}
        </svg>
      </button>

      <div className="logo-wrap">
        <div className="logo-mark">✦</div>
        <span className="logo-name">StudyAI</span>
      </div>

      <div className="nav-bc"><b>{bcText}</b></div>

      <span className="kbd-badge" onClick={() => onSetTool('settings')} style={{ cursor: 'pointer' }}>?</span>

      {S.pom.running && S.tool !== 'pomodoro' && (
        <button onClick={onPomBadgeClick} className="pom-nav-badge">
          <span className="pom-nav-dot" />
          {pomBadgeTime}
        </button>
      )}

      <button className="nb" onClick={onSearch} title="Search chats (Ctrl+K)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>

      <button className="nb" onClick={onToggleTheme} aria-label="Toggle theme">
        {S.darkMode ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>

      <button className="nb" onClick={() => onSetTool('settings')} title="Settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>

      {/* Auth — hook-based, no SignedIn/SignedOut components */}
      {!isSignedIn ? (
        <SignInButton mode="modal">
          <button className="sign-btn">Sign In</button>
        </SignInButton>
      ) : (
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'clerk-avatar',
              userButtonPopoverCard: 'clerk-popover',
              userButtonPopoverActionButton: 'clerk-popover-btn',
              userButtonPopoverActionButtonText: 'clerk-popover-btn-text',
              userButtonPopoverFooter: 'clerk-popover-footer',
            },
          }}
        />
      )}
    </nav>
  );
}
