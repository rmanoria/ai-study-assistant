"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Plus, MessageSquare, Trash2,
  Pencil, Pin, Archive, Star, Menu, X, FileText, Paperclip,
  MoreVertical, Check,
} from "lucide-react";

import AnimatedBackground from "./components/AnimatedBackground";
import ChatBubble from "./components/ChatBubble";
import TypingLoader from "./components/TypingLoader";
import FlashcardPanel from "./components/FlashcardPanel";
import QuizPanel from "./components/QuizPanel";
import NotesPanel from "./components/NotesPanel";
import SummarizerPanel from "./components/SummarizerPanel";
import PlannerPanel from "./components/PlannerPanel";

type Message = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  fileName?: string;
};
type Chat = {
  id: string; title: string; messages: Message[];
  pinned?: boolean; archived?: boolean; highlighted?: boolean;
};
type Tool = "chat" | "flashcards" | "quiz" | "notes" | "summarizer" | "planner";
type Mode = "quick" | "deep" | "research" | "socratic";

type Attachment =
  | { kind: "image"; file: File; previewUrl: string }
  | { kind: "doc";   file: File; extractedText: string };

const TOOL_CONFIG: { id: Tool; emoji: string; label: string }[] = [
  { id: "flashcards", emoji: "🃏", label: "Flashcards" },
  { id: "quiz",       emoji: "🧠", label: "Quiz"       },
  { id: "notes",      emoji: "📝", label: "Notes"      },
  { id: "summarizer", emoji: "⚡", label: "Summarizer" },
  { id: "planner",    emoji: "📅", label: "Planner"    },
];

const STARTERS: Message[] = [{
  role: "assistant",
  content: "# Welcome to StudyAI Pro ✦\n\nI'm your advanced AI study assistant.\n\n**What I can do:**\n- Explain any concept clearly at any level\n- Solve math, science, coding, and writing problems\n- Analyze images from your textbooks or notes\n- Read and discuss PDF and Word documents\n- Help with essays, research, and assignments\n\nPick a mode above, or just ask me anything. Let's get studying! 🚀",
}];

const QUICK_PROMPTS = [
  "Explain this simply",
  "Practice problems",
  "Summarize key points",
  "Help me outline",
  "Quiz me",
];

// ── PDF/DOCX text extraction ──────────────────────────────────
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs.GlobalWorkerOptions as any).workerSrc = "";
  const ab  = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(ab), disableFontFace: true }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    pages.push(content.items.map((i: unknown) => (i as { str?: string }).str ?? "").join(" "));
  }
  return pages.join("\n\n").trim();
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const ab      = await file.arrayBuffer();
  return (await mammoth.extractRawText({ arrayBuffer: ab })).value.trim();
}

async function extractDocText(file: File): Promise<string> {
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf"))                          return extractPdfText(file);
  if (n.endsWith(".docx") || n.endsWith(".doc"))  return extractDocxText(file);
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = (e) => res((e.target?.result as string) ?? "");
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsText(file);
  });
}

function isDocFile(file: File) {
  const n = file.name.toLowerCase();
  return n.endsWith(".pdf") || n.endsWith(".doc") || n.endsWith(".docx") || n.endsWith(".txt");
}
function isImageFile(file: File) { return file.type.startsWith("image/"); }

// ── Swipeable chat row ────────────────────────────────────────
function SwipeableChatRow({
  chat, isActive, onSelect, onPin, onArchive, onHighlight, onRename, onDelete,
  menuOpen, onMenuToggle, onMenuClose,
}: {
  chat: Chat; isActive: boolean;
  onSelect: () => void; onPin: () => void; onArchive: () => void;
  onHighlight: () => void; onRename: () => void; onDelete: () => void;
  menuOpen: boolean; onMenuToggle: () => void; onMenuClose: () => void;
}) {
  const rowRef    = useRef<HTMLDivElement>(null);
  const startX    = useRef<number | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const REVEAL    = 152; // px to reveal action strip

  // Close swipe when menu closes from outside
  useEffect(() => { if (!menuOpen) { setSwipeX(0); } }, [menuOpen]);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent | TouchEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) onMenuClose();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [menuOpen, onMenuClose]);

  function onTouchStart(e: React.TouchEvent) { startX.current = e.touches[0].clientX; }
  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = startX.current - e.touches[0].clientX;
    if (dx > 0) setSwipeX(Math.min(dx, REVEAL));
  }
  function onTouchEnd() {
    if (swipeX > 60) { setSwipeX(REVEAL); onMenuToggle(); }
    else { setSwipeX(0); onMenuClose(); }
    startX.current = null;
  }

  const actions = [
    { icon: <Pin size={11} />,     label: chat.pinned      ? "Unpin"       : "Pin",       color: "text-amber-400  hover:bg-amber-500/10",  fn: onPin },
    { icon: <Archive size={11} />, label: chat.archived    ? "Unarchive"   : "Archive",   color: "text-blue-400   hover:bg-blue-500/10",    fn: onArchive },
    { icon: <Star size={11} />,    label: chat.highlighted ? "Unstar"      : "⭐ Star",    color: "text-yellow-400 hover:bg-yellow-500/10",  fn: onHighlight },
    { icon: <Pencil size={11} />,  label: "Rename",                                        color: "text-gray-300   hover:bg-white/8",         fn: onRename },
    { icon: <Trash2 size={11} />,  label: "Delete",                                        color: "text-red-400    hover:bg-red-500/10",      fn: onDelete },
  ];

  return (
    <div ref={rowRef} className="relative overflow-hidden rounded-xl mb-0.5">
      {/* ── Action strip (swipe / ⋮ dropdown) ── */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-stretch z-10 transition-opacity duration-150"
        style={{ opacity: swipeX > 8 || menuOpen ? 1 : 0, pointerEvents: swipeX > 8 || menuOpen ? "auto" : "none" }}
      >
        {/* Vertical mini strip revealed by swipe on mobile */}
        <div className="flex items-stretch">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => { a.fn(); onMenuClose(); setSwipeX(0); }}
              className={`flex flex-col items-center justify-center gap-0.5 w-8 text-[9px] font-bold border-l border-white/5 transition-colors ${a.color}`}
              style={{ display: swipeX > 8 ? "flex" : "none" }}
            >
              {a.icon}
              <span className="leading-none">{a.label.replace("⭐ ", "").slice(0, 7)}</span>
            </button>
          ))}
        </div>

        {/* Desktop dropdown */}
        {menuOpen && (
          <div className="absolute right-0 top-8 z-50 min-w-40 rounded-xl border border-white/10 bg-[#0f0f1e] shadow-2xl overflow-hidden">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={() => { a.fn(); onMenuClose(); setSwipeX(0); }}
                className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-medium transition-colors ${a.color} ${i < actions.length - 1 ? "border-b border-white/5" : ""}`}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Chat row ── */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(-${swipeX}px)`, transition: startX.current ? "none" : "transform 0.25s ease" }}
        className={`flex items-center gap-1 px-2.5 py-2 rounded-xl transition-colors cursor-pointer select-none
          ${isActive ? "bg-violet-600/30 border border-violet-500/30" : "hover:bg-white/5 border border-transparent"}
          ${chat.highlighted ? "ring-1 ring-yellow-500/40" : ""}`}
      >
        <button
          onClick={onSelect}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          {chat.pinned && <Pin size={9} className="text-amber-400 shrink-0" />}
          <MessageSquare size={11} className="text-gray-500 shrink-0" />
          <span className="truncate text-xs text-gray-300 leading-tight">{chat.title}</span>
        </button>

        {/* ⋮ — desktop menu trigger */}
        <button
          onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
          className="shrink-0 p-1 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/10 transition-colors"
        >
          <MoreVertical size={12} />
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { isSignedIn } = useUser();

  const [chats, setChats]               = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [activeTool, setActiveTool]     = useState<Tool>("chat");
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [openMenuId, setOpenMenuId]     = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true);
  }, []);

  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [attachment, setAttachment]     = useState<Attachment | null>(null);
  const [extracting, setExtracting]     = useState(false);
  const [mode, setMode]                 = useState<Mode>("quick");
  const [autoScroll, setAutoScroll]     = useState(true);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [expandedMsgIdx, setExpandedMsgIdx] = useState<number | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLTextAreaElement>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);

  // ── Load chats from localStorage ──
  useEffect(() => {
    const saved = localStorage.getItem("studyai-pro-chats");
    if (saved) {
      const parsed: Chat[] = JSON.parse(saved);
      if (parsed.length > 0) { setChats(parsed); setActiveChatId(parsed[0].id); return; }
    }
    const initial = createChatObj();
    setChats([initial]);
    setActiveChatId(initial.id);
  }, []);

  useEffect(() => {
    if (chats.length > 0) localStorage.setItem("studyai-pro-chats", JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (autoScroll && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [chats, loading, autoScroll]);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const handler = () => { setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 150); };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (attachment?.kind === "image") URL.revokeObjectURL(attachment.previewUrl);
    };
  }, [attachment]);

  // ── File handling ──
  async function handleFileSelect(file: File) {
    if (attachment?.kind === "image") URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    if (isImageFile(file)) {
      setAttachment({ kind: "image", file, previewUrl: URL.createObjectURL(file) });
    } else if (isDocFile(file)) {
      setExtracting(true);
      try {
        const text = await extractDocText(file);
        setAttachment({ kind: "doc", file, extractedText: text });
      } catch {
        alert("Could not read this file. Try a different PDF or DOCX.");
      } finally {
        setExtracting(false);
      }
    } else {
      alert("Supported: images, PDF, DOCX, TXT");
    }
  }

  function clearAttachment() {
    if (attachment?.kind === "image") URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Chat management ──
  function createChatObj(): Chat {
    return { id: Date.now().toString(), title: "New Chat", messages: [...STARTERS] };
  }

  function newChat() {
    const chat = createChatObj();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setActiveTool("chat");
    setOpenMenuId(null);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  function deleteChat(id: string) {
    setChats((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      if (activeChatId === id && updated.length > 0) setActiveChatId(updated[0].id);
      if (updated.length === 0) {
        const fallback = createChatObj();
        setActiveChatId(fallback.id);
        return [fallback];
      }
      return updated;
    });
  }

  function renameChat(id: string) {
    const t = prompt("Rename chat:");
    if (!t?.trim()) return;
    setChats((prev) => prev.map((c) => c.id === id ? { ...c, title: t.trim() } : c));
  }

  function pinChat(id: string)       { setChats((prev) => prev.map((c) => c.id === id ? { ...c, pinned:      !c.pinned      } : c)); }
  function archiveChat(id: string)   { setChats((prev) => prev.map((c) => c.id === id ? { ...c, archived:    !c.archived    } : c)); }
  function highlightChat(id: string) { setChats((prev) => prev.map((c) => c.id === id ? { ...c, highlighted: !c.highlighted } : c)); }

  const currentChat = chats.find((c) => c.id === activeChatId);
  const messages    = currentChat?.messages || [];

  const sendToChat = useCallback((text: string) => {
    setActiveTool("chat");
    setInput(text);
    inputRef.current?.focus();
  }, []);

  // ── Send message ──
  async function sendMessage() {
    const hasText = input.trim().length > 0;
    const hasFile = attachment !== null;
    if (!hasText && !hasFile) return;

    let userContent = input.trim();
    let imageUrl: string | undefined;
    const imageFile = attachment?.kind === "image" ? attachment.file : null;
    imageUrl        = attachment?.kind === "image" ? attachment.previewUrl : undefined;

    if (attachment?.kind === "doc") {
      const excerpt = attachment.extractedText.slice(0, 12000);
      userContent = userContent
        ? `${userContent}\n\n[Document: ${attachment.file.name}]\n\n${excerpt}`
        : `Please analyze this document — "${attachment.file.name}" — and respond to any questions about it.\n\n${excerpt}`;
    }

    if (!userContent) userContent = "Analyze this image for studying.";

    const newUserMsg: Message = {
      role: "user",
      content: userContent,
      imageUrl,
      fileName: attachment?.kind === "doc" ? attachment.file.name : undefined,
    };
    const newMessages: Message[] = [...messages, newUserMsg];

    setChats((prev) => prev.map((c) =>
      c.id === activeChatId ? {
        ...c,
        title: c.title === "New Chat"
          ? (input.trim() || (attachment?.kind === "doc" ? attachment.file.name : "Document")).slice(0, 30) + "…"
          : c.title,
        messages: newMessages,
      } : c
    ));

    setInput("");
    setLoading(true);
    setExpandedMsgIdx(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
    clearAttachment();

    try {
      const formData = new FormData();
      formData.append("messages", JSON.stringify(newMessages.map(({ role, content }) => ({ role, content }))));
      formData.append("mode", mode);
      if (imageFile instanceof File) formData.append("image", imageFile);

      const res       = await fetch("/api/chat", { method: "POST", body: formData });
      const data      = await res.json();
      const fullReply = data.reply || "No response returned.";

      // Start with empty assistant bubble
      setChats((prev) => prev.map((c) =>
        c.id === activeChatId
          ? { ...c, messages: [...c.messages, { role: "assistant", content: "" }] }
          : c
      ));

      // Stream-type the response
      let typed = "";
      for (let i = 0; i < fullReply.length; i++) {
        typed += fullReply[i];
        if (i % 30 === 0) {
          const snapshot = typed;
          setChats((prev) => prev.map((c) => {
            if (c.id !== activeChatId) return c;
            const msgs = [...c.messages];
            msgs[msgs.length - 1] = { role: "assistant", content: snapshot };
            return { ...c, messages: msgs };
          }));
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // Final full message
      setChats((prev) => prev.map((c) => {
        if (c.id !== activeChatId) return c;
        const msgs = [...c.messages];
        msgs[msgs.length - 1] = { role: "assistant", content: fullReply };
        return { ...c, messages: msgs };
      }));
    } catch {
      setChats((prev) => prev.map((c) =>
        c.id === activeChatId
          ? { ...c, messages: [...c.messages, { role: "assistant", content: "⚠️ Something went wrong. Please try again." }] }
          : c
      ));
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function copyMsg(content: string, idx: number) {
    navigator.clipboard?.writeText(content);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  }

  const sortedChats   = [...chats].filter((c) => !c.archived).sort((a, b) => (a.pinned ? -1 : b.pinned ? 1 : 0));
  const archivedChats = chats.filter((c) => c.archived);
  const canSend       = !loading && !extracting && (input.trim().length > 0 || attachment !== null);

  const MODE_CONFIG = {
    quick:    { label: "⚡ Quick",    icon: "⚡", color: "bg-violet-600",  desc: "Concise" },
    deep:     { label: "🧠 Deep",     icon: "🧠", color: "bg-purple-700",  desc: "Thorough" },
    research: { label: "🔬 Research", icon: "🔬", color: "bg-emerald-700", desc: "Scholarly" },
    socratic: { label: "💭 Socratic", icon: "💭", color: "bg-rose-700",    desc: "Guided" },
  } as const;

  return (
    <main className="relative flex h-screen overflow-hidden bg-transparent text-white">
      <AnimatedBackground />

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ══════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════ */}
      <aside className={`
        fixed md:relative z-50 h-full flex flex-col border-r border-white/8 backdrop-blur-2xl transition-transform duration-300
        w-72 md:w-64
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-full md:w-0 md:overflow-hidden"}
        bg-black/90 md:bg-black/60
      `}>

        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/8 shrink-0">
          <h1 className="text-lg font-black tracking-tight bg-linear-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            StudyAI Pro ✦
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Your intelligent study workspace</p>
        </div>

        {/* Auth */}
        <div className="px-4 py-3 border-b border-white/8 shrink-0">
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <button className="w-full rounded-xl bg-linear-to-r from-violet-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
                🚀 Sign in to sync
              </button>
            </SignInButton>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Signed in ✨</p>
                <p className="text-[11px] text-gray-500">Chats synced</p>
              </div>
              <UserButton />
            </div>
          )}
        </div>

        {/* Study Tools */}
        <div className="px-4 py-3 pb-2 shrink-0 border-b border-white/8">
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-1.5">Study Tools</p>
          <div className="flex flex-col gap-0.5">
            {TOOL_CONFIG.map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveTool(t.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all text-left
                  ${activeTool === t.id ? "bg-white/10 text-white border border-white/15" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}
              >
                <span className="text-base">{t.emoji}</span>
                <span className="font-medium text-sm">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* New Chat */}
        <div className="px-4 py-3 shrink-0 border-b border-white/8">
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold transition-all"
          >
            <Plus size={15} /> New Chat
          </button>
        </div>

        {/* ── Chat History ── */}
        <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1">
          {/* Active chats header */}
          <div className="flex items-center justify-between py-1 sticky top-0 bg-transparent">
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600">
              Chats <span className="text-gray-700 normal-case font-normal">({sortedChats.length})</span>
            </p>
          </div>

          {sortedChats.length === 0 && (
            <p className="text-xs text-gray-600 px-1 py-2">No chats yet — start one above.</p>
          )}

          {sortedChats.map((chat) => (
            <SwipeableChatRow
              key={chat.id}
              chat={chat}
              isActive={activeChatId === chat.id && activeTool === "chat"}
              onSelect={() => { setActiveChatId(chat.id); setActiveTool("chat"); setOpenMenuId(null); if (window.innerWidth < 768) setSidebarOpen(false); }}
              onPin={() => pinChat(chat.id)}
              onArchive={() => archiveChat(chat.id)}
              onHighlight={() => highlightChat(chat.id)}
              onRename={() => renameChat(chat.id)}
              onDelete={() => deleteChat(chat.id)}
              menuOpen={openMenuId === chat.id}
              onMenuToggle={() => setOpenMenuId(openMenuId === chat.id ? null : chat.id)}
              onMenuClose={() => setOpenMenuId(null)}
            />
          ))}

          {/* Archived section */}
          {archivedChats.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-gray-600 hover:text-gray-400 transition-colors mb-1"
              >
                <Archive size={10} />
                Archived ({archivedChats.length})
                <span className="ml-0.5">{showArchived ? "▲" : "▼"}</span>
              </button>
              {showArchived && archivedChats.map((chat) => (
                <div key={chat.id} className="flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/5 mb-0.5">
                  <Archive size={10} className="text-gray-600 shrink-0" />
                  <span className="flex-1 truncate text-xs text-gray-500">{chat.title}</span>
                  <button onClick={() => archiveChat(chat.id)} title="Unarchive"
                    className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors text-xs">↩</button>
                  <button onClick={() => deleteChat(chat.id)} title="Delete"
                    className="p-1 hover:bg-red-500/15 rounded text-red-500 hover:text-red-400 transition-colors">
                    <Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MAIN
      ══════════════════════════════════════ */}
      <section className="relative flex flex-1 flex-col overflow-hidden min-w-0">

        {/* TOPBAR */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-white/8 backdrop-blur-xl bg-black/20 shrink-0 relative z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0 p-2 sm:p-2.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 transition-colors text-gray-300 hover:text-white active:scale-95"
          >
            {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
          </button>

          <div className="flex-1 text-sm font-semibold truncate min-w-0">
            {activeTool === "chat"
              ? (currentChat?.title || "Chat")
              : TOOL_CONFIG.find((t) => t.id === activeTool)?.label || ""}
          </div>

          {activeTool === "chat" && (
            <div className="flex gap-1 sm:gap-1.5 shrink-0 flex-wrap justify-end">
              {(Object.keys(MODE_CONFIG) as Mode[]).map((m) => {
                const cfg = MODE_CONFIG[m];
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    title={cfg.desc}
                    className={`rounded-full font-bold border transition-all px-2 py-1.5 text-sm md:px-3 md:text-[11px]
                      ${mode === m
                        ? `${cfg.color} border-transparent text-white shadow-md`
                        : "bg-transparent border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                      }`}
                  >
                    <span className="md:hidden">{cfg.icon}</span>
                    <span className="hidden md:inline">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* TOOL PANELS */}
        {activeTool !== "chat" && (
          <div className="flex flex-1 overflow-hidden">
            {activeTool === "flashcards" && <FlashcardPanel />}
            {activeTool === "quiz"       && <QuizPanel />}
            {activeTool === "notes"      && <NotesPanel onSendToChat={sendToChat} />}
            {activeTool === "summarizer" && <SummarizerPanel />}
            {activeTool === "planner"    && <PlannerPanel />}
          </div>
        )}

        {/* CHAT VIEW */}
        {activeTool === "chat" && (
          <>
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm shrink-0 mt-0.5
                    ${msg.role === "user" ? "bg-violet-600" : "bg-linear-to-br from-violet-500 to-cyan-500"}`}>
                    {msg.role === "user" ? "👤" : "✦"}
                  </div>

                  <div className={`max-w-[85%] sm:max-w-[80%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    {/* Image */}
                    {msg.role === "user" && msg.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-violet-500/30 shadow-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={msg.imageUrl} alt="Uploaded" className="max-w-55 sm:max-w-65 max-h-45 sm:max-h-50 object-cover block" />
                      </div>
                    )}

                    {/* Doc chip */}
                    {msg.role === "user" && msg.fileName && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-violet-600/20 border border-violet-500/30 rounded-xl text-xs text-violet-300">
                        <FileText size={13} className="shrink-0" />
                        <span className="truncate max-w-40 font-medium">{msg.fileName}</span>
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`rounded-2xl px-4 py-3 sm:px-5 sm:py-4 shadow-lg
                      ${msg.role === "user"
                        ? "bg-violet-600 text-white rounded-tr-sm"
                        : "bg-black/40 border border-white/10 backdrop-blur-xl rounded-tl-sm"}`}>
                      {msg.role === "user" ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.fileName
                            ? (msg.content.includes(`[Document: ${msg.fileName}]`)
                                ? msg.content.split(`[Document: ${msg.fileName}]`)[0].trim() || `Shared document: ${msg.fileName}`
                                : msg.content.split("Please analyze this document")[0].trim() || `Shared: ${msg.fileName}`)
                            : msg.content}
                        </p>
                      ) : (
                        <ChatBubble role={msg.role} content={msg.content} darkMode={true} />
                      )}
                    </div>

                    {/* Message actions */}
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {/* Mobile toggle */}
                        <button
                          onClick={() => setExpandedMsgIdx(expandedMsgIdx === i ? null : i)}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-500 hover:text-gray-300 transition-colors md:hidden"
                        >
                          <MoreVertical size={10} /> Actions
                        </button>

                        <div className={`flex gap-1.5 flex-wrap transition-all ${expandedMsgIdx === i ? "flex" : "hidden"} md:flex`}>
                          <button
                            onClick={() => copyMsg(msg.content, i)}
                            className={`text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-1 border rounded-lg transition-colors
                              ${copiedMsgIdx === i
                                ? "bg-green-600/20 border-green-500/40 text-green-400"
                                : "bg-white/5 border-white/10 text-gray-400 hover:text-white"}`}
                          >
                            {copiedMsgIdx === i ? <><Check size={10} className="inline mr-1" />Copied!</> : "📋 Copy"}
                          </button>
                          <button
                            onClick={() => setActiveTool("flashcards")}
                            className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                          >🃏 Flashcards</button>
                          <button
                            onClick={() => {
                              localStorage.setItem("studyai-new-note", JSON.stringify({ title: "AI Response", body: msg.content }));
                              setActiveTool("notes");
                            }}
                            className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                          >📝 Save</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-linear-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs shrink-0">✦</div>
                  <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl rounded-tl-sm px-4 py-3 sm:px-5 sm:py-4">
                    <TypingLoader />
                  </div>
                </div>
              )}
            </div>

            {/* INPUT AREA */}
            <div className="px-3 sm:px-5 pb-4 sm:pb-5 pt-2 sm:pt-3 backdrop-blur-xl bg-black/10 shrink-0">
              {/* Quick prompts */}
              <div className="flex gap-2 mb-2 sm:mb-3 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setInput(p); inputRef.current?.focus(); }}
                    className="shrink-0 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/40 text-gray-400 hover:text-violet-300 rounded-full text-xs font-medium transition-all"
                  >{p}</button>
                ))}
              </div>

              {/* Attachment preview */}
              {(attachment || extracting) && (
                <div className="mb-2 sm:mb-3 flex items-start gap-2 sm:gap-3">
                  {extracting && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-gray-400 animate-pulse">
                      <FileText size={13} /> Reading document…
                    </div>
                  )}
                  {attachment?.kind === "image" && (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={attachment.previewUrl} alt="To send"
                        className="h-16 sm:h-20 w-auto max-w-30 sm:max-w-40 rounded-xl object-cover border border-violet-500/40 shadow-md" />
                      <button onClick={clearAttachment}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow-md hover:bg-red-400">✕</button>
                    </div>
                  )}
                  {attachment?.kind === "doc" && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-violet-600/15 border border-violet-500/30 rounded-xl">
                      <FileText size={14} className="text-violet-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-violet-300 truncate max-w-45">{attachment.file.name}</p>
                        <p className="text-[10px] text-gray-500">
                          {attachment.extractedText.split(/\s+/).filter(Boolean).length.toLocaleString()} words · ready to discuss
                        </p>
                      </div>
                      <button onClick={clearAttachment}
                        className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1 shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Input row */}
              <div className="flex items-end gap-2 sm:gap-3">
                <label className={`shrink-0 p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all
                  ${attachment
                    ? "bg-violet-600/20 border-violet-500/50 text-violet-400"
                    : "bg-white/5 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white"
                  }`} title="Attach image, PDF, or document">
                  <Paperclip size={17} />
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
                </label>

                <div className="flex-1 bg-white/5 border border-white/10 focus-within:border-violet-500/50 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 transition-colors min-w-0">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                    onKeyDown={handleKey}
                    placeholder={
                      extracting ? "Reading document…"
                      : attachment?.kind === "doc"   ? `Ask anything about ${attachment.file.name}…`
                      : attachment?.kind === "image" ? "Add a message about this image… (optional)"
                      : "Ask anything… or attach a PDF / image"
                    }
                    rows={1}
                    disabled={extracting}
                    className="w-full bg-transparent outline-none text-white placeholder:text-gray-500 text-sm resize-none leading-6 max-h-28 disabled:opacity-50"
                  />
                </div>

                <button
                  onClick={sendMessage}
                  disabled={!canSend}
                  className="shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-linear-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg transition-all hover:scale-105 disabled:opacity-40 disabled:scale-100"
                >
                  <Send size={16} className="text-white sm:hidden" />
                  <Send size={18} className="text-white hidden sm:block" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}