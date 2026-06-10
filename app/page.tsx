"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Plus, MessageSquare, Trash2, Pencil, Pin, Archive, Star,
  Menu, X, FileText, Paperclip, MoreVertical, Check, Sun, Moon,
  ChevronDown,
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

const TOOL_CONFIG: { id: Tool; emoji: string; label: string; desc: string }[] = [
  { id: "flashcards", emoji: "🃏", label: "Flashcards", desc: "AI-generated study cards" },
  { id: "quiz",       emoji: "🧠", label: "Quiz",       desc: "Test your knowledge" },
  { id: "notes",      emoji: "📝", label: "Notes",      desc: "Smart note-taking" },
  { id: "summarizer", emoji: "⚡", label: "Summarizer", desc: "Analyse any document" },
  { id: "planner",    emoji: "📅", label: "Planner",    desc: "Study schedules & plans" },
];

const STARTERS: Message[] = [{
  role: "assistant",
  content: `## Hey there! I'm StudyAI ✦

Your personal academic tutor — ready to help with anything from basic concepts to graduate-level research.

**Here's what I can do:**
- Explain any topic clearly, at whatever depth you need
- Solve maths, science, coding, writing, and more — step by step
- Analyse images from your textbooks or handwritten notes
- Read and discuss PDFs, Word docs, and text files
- Adapt to your level: quick answers or deep dives

**Choose a mode** in the toolbar above, then ask me anything. The tools in the sidebar are here whenever you're ready. Let's study! 🚀`,
}];

const QUICK_PROMPTS = [
  "Explain this concept",
  "Give me practice problems",
  "Summarise key points",
  "Help me write an outline",
  "Quiz me on this topic",
];

const MODE_CONFIG = {
  quick:    { label: "Quick",    icon: "⚡", color: "from-violet-600 to-violet-500",  desc: "Concise answers" },
  deep:     { label: "Deep",     icon: "🧠", color: "from-purple-700 to-purple-600",  desc: "Thorough explanation" },
  research: { label: "Research", icon: "🔬", color: "from-emerald-700 to-emerald-600",desc: "Academic depth" },
  socratic: { label: "Socratic", icon: "💭", color: "from-rose-700 to-rose-600",      desc: "Guided discovery" },
} as const;

// ── PDF / DOCX extraction ─────────────────────────────────────
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs.GlobalWorkerOptions as any).workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
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
  if (n.endsWith(".pdf"))                         return extractPdfText(file);
  if (n.endsWith(".docx") || n.endsWith(".doc")) return extractDocxText(file);
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

// ── Logo component ────────────────────────────────────────────
function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { outer: 28, inner: 18, text: "text-sm", sub: "text-[10px]" },
    md: { outer: 36, inner: 22, text: "text-base", sub: "text-[11px]" },
    lg: { outer: 48, inner: 30, text: "text-xl", sub: "text-sm" },
  }[size];

  return (
    <div className="flex items-center gap-2.5">
      {/* Geometric mark */}
      <div
        className="shrink-0 rounded-xl flex items-center justify-center relative"
        style={{
          width: sizes.outer, height: sizes.outer,
          background: "linear-gradient(135deg, #7c5af0 0%, #22d3ee 100%)",
          boxShadow: "0 0 16px rgba(124,90,240,0.4)",
        }}
      >
        <span style={{ fontSize: sizes.inner }} className="select-none leading-none">✦</span>
      </div>
      <div>
        <div className={`${sizes.text} font-black tracking-tight leading-tight`}
          style={{ background: "linear-gradient(90deg,#a78bfa,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          StudyAI
        </div>
        <div className={`${sizes.sub} text-[#5a5a7a] leading-tight font-medium`}>
          Smart learning, simplified
        </div>
      </div>
    </div>
  );
}

// ── Chat row ──────────────────────────────────────────────────
function ChatRow({
  chat, isActive, onSelect, onPin, onArchive, onHighlight, onRename, onDelete,
  menuOpen, onMenuToggle, onMenuClose,
}: {
  chat: Chat; isActive: boolean;
  onSelect: () => void; onPin: () => void; onArchive: () => void;
  onHighlight: () => void; onRename: () => void; onDelete: () => void;
  menuOpen: boolean; onMenuToggle: () => void; onMenuClose: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent | TouchEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) onMenuClose();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [menuOpen, onMenuClose]);

  const actions = [
    { icon: <Pin size={12} />,     label: chat.pinned      ? "Unpin"     : "Pin",     fn: onPin,       color: "text-amber-400" },
    { icon: <Star size={12} />,    label: chat.highlighted ? "Unstar"    : "Star",    fn: onHighlight, color: "text-yellow-400" },
    { icon: <Archive size={12} />, label: chat.archived    ? "Unarchive" : "Archive", fn: onArchive,   color: "text-blue-400" },
    { icon: <Pencil size={12} />,  label: "Rename",                                   fn: onRename,    color: "text-gray-300" },
    { icon: <Trash2 size={12} />,  label: "Delete",                                   fn: onDelete,    color: "text-red-400" },
  ];

  return (
    <div ref={rowRef} className="relative group">
      <div
        onClick={onSelect}
        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150 select-none
          ${isActive
            ? "bg-violet-600/25 border border-violet-500/35"
            : "border border-transparent hover:bg-white/5 hover:border-white/8"
          }
          ${chat.highlighted ? "ring-1 ring-yellow-500/35" : ""}`}
      >
        {chat.pinned && <Pin size={9} className="text-amber-400 shrink-0" />}
        <MessageSquare size={11} className="text-[#5a5a7a] shrink-0" />
        <span className="flex-1 truncate text-xs text-[#9a9ab8] leading-tight">{chat.title}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
          className="shrink-0 p-1 rounded-lg text-[#5a5a7a] hover:text-gray-300 hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreVertical size={12} />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-0 top-8 z-50 w-40 rounded-xl border border-white/10 bg-[#0e0e1e] shadow-2xl overflow-hidden animate-fade-in">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => { a.fn(); onMenuClose(); }}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-medium transition-colors hover:bg-white/6 ${a.color}
                ${i < actions.length - 1 ? "border-b border-white/5" : ""}`}
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function Home() {
  const { isSignedIn } = useUser();

  const [chats, setChats]               = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [activeTool, setActiveTool]     = useState<Tool>("chat");
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [openMenuId, setOpenMenuId]     = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [darkMode, setDarkMode]         = useState(true);

  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [attachment, setAttachment]     = useState<Attachment | null>(null);
  const [extracting, setExtracting]     = useState(false);
  const [mode, setMode]                 = useState<Mode>("quick");
  const [autoScroll, setAutoScroll]     = useState(true);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [modeDropdown, setModeDropdown] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLTextAreaElement>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const modeRef          = useRef<HTMLDivElement>(null);

  // Init sidebar on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true);
  }, []);

  // Close mode dropdown outside click
  useEffect(() => {
    if (!modeDropdown) return;
    function handler(e: MouseEvent) {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modeDropdown]);

  // Load chats
  useEffect(() => {
    const saved = localStorage.getItem("studyai-chats-v2");
    if (saved) {
      try {
        const parsed: Chat[] = JSON.parse(saved);
        if (parsed.length > 0) { setChats(parsed); setActiveChatId(parsed[0].id); return; }
      } catch { /* ignore */ }
    }
    const initial = createChatObj();
    setChats([initial]);
    setActiveChatId(initial.id);
  }, []);

  useEffect(() => {
    if (chats.length > 0) localStorage.setItem("studyai-chats-v2", JSON.stringify(chats));
  }, [chats]);

  // Auto-scroll
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

  // Attachment cleanup
  useEffect(() => {
    return () => { if (attachment?.kind === "image") URL.revokeObjectURL(attachment.previewUrl); };
  }, [attachment]);

  // Dark mode toggle on html element
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
  }, [darkMode]);

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
        alert("Could not read this file. Try a different PDF, DOCX, or TXT.");
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
      const excerpt = attachment.extractedText.slice(0, 14000);
      userContent = userContent
        ? `${userContent}\n\n[Document: ${attachment.file.name}]\n\n${excerpt}`
        : `Please analyse this document — "${attachment.file.name}" — and provide a thorough summary with key points.\n\n${excerpt}`;
    }

    if (!userContent) userContent = "Analyse this image for studying.";

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
          ? (input.trim() || (attachment?.kind === "doc" ? attachment.file.name : "Document")).slice(0, 32) + "…"
          : c.title,
        messages: newMessages,
      } : c
    ));

    setInput("");
    setLoading(true);
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

      setChats((prev) => prev.map((c) =>
        c.id === activeChatId
          ? { ...c, messages: [...c.messages, { role: "assistant", content: "" }] }
          : c
      ));

      // Stream the response
      let typed = "";
      for (let i = 0; i < fullReply.length; i++) {
        typed += fullReply[i];
        if (i % 20 === 0) {
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
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  function copyMsg(content: string, idx: number) {
    navigator.clipboard?.writeText(content);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  }

  const sortedChats   = [...chats].filter((c) => !c.archived).sort((a, b) => (a.pinned ? -1 : b.pinned ? 1 : 0));
  const archivedChats = chats.filter((c) => c.archived);
  const canSend       = !loading && !extracting && (input.trim().length > 0 || attachment !== null);
  const currentMode   = MODE_CONFIG[mode];

  const lightBg = darkMode ? "" : "bg-[#f5f5ff]";
  const lightText = darkMode ? "text-white" : "text-[#1a1a3e]";
  const lightBorder = darkMode ? "border-white/7" : "border-black/8";
  const lightSurface = darkMode ? "bg-black/60" : "bg-white/80";
  const lightMuted = darkMode ? "text-[#9a9ab8]" : "text-[#666690]";

  return (
    <main className={`relative flex h-screen overflow-hidden ${lightBg} ${lightText}`}>
      {!darkMode && <div className="fixed inset-0 -z-10 bg-[#f5f5ff]" />}
      {darkMode && <AnimatedBackground />}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed md:relative z-50 h-full flex flex-col border-r ${lightBorder} transition-all duration-300 shrink-0
        w-68
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-full md:w-0 md:overflow-hidden"}
        ${darkMode ? "bg-[#070711]/95 backdrop-blur-2xl" : "bg-white/95 backdrop-blur-2xl shadow-xl"}
      `}>

        {/* Logo */}
        <div className={`px-4 py-4 border-b ${lightBorder} shrink-0`}>
          <Logo size="md" />
        </div>

        {/* Auth */}
        <div className={`px-4 py-3 border-b ${lightBorder} shrink-0`}>
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <button className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-98"
                style={{ background: "linear-gradient(135deg,#7c5af0,#22d3ee)" }}>
                Sign in to sync chats
              </button>
            </SignInButton>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-semibold ${lightText}`}>Signed in ✓</p>
                <p className={`text-[11px] ${lightMuted}`}>Chats saved to account</p>
              </div>
              <UserButton />
            </div>
          )}
        </div>

        {/* Study tools */}
        <div className={`px-4 py-3 border-b ${lightBorder} shrink-0`}>
          <p className={`text-[10px] uppercase tracking-widest font-bold ${lightMuted} mb-2`}>Study Tools</p>
          <div className="flex flex-col gap-0.5">
            {TOOL_CONFIG.map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveTool(t.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all text-left group
                  ${activeTool === t.id
                    ? `${darkMode ? "bg-violet-600/20 border-violet-500/30" : "bg-violet-50 border-violet-200"} border text-violet-400`
                    : `${lightMuted} ${darkMode ? "hover:bg-white/5" : "hover:bg-gray-50"} border border-transparent hover:text-gray-600`}`}
              >
                <span className="text-base">{t.emoji}</span>
                <div className="min-w-0">
                  <div className={`font-medium text-xs leading-tight ${activeTool === t.id ? "text-violet-300" : lightText}`}>{t.label}</div>
                  <div className={`text-[10px] leading-tight ${lightMuted}`}>{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* New chat */}
        <div className={`px-4 py-3 border-b ${lightBorder} shrink-0`}>
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-98"
            style={{ background: "linear-gradient(135deg,#7c5af0,#5b8def)" }}
          >
            <Plus size={15} /> New Chat
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-0.5">
          <p className={`text-[10px] uppercase tracking-widest font-bold ${lightMuted} px-1 py-1.5`}>
            Chats ({sortedChats.length})
          </p>

          {sortedChats.length === 0 && (
            <p className={`text-xs ${lightMuted} px-2 py-3`}>No chats yet — start one above.</p>
          )}

          {sortedChats.map((chat) => (
            <ChatRow
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

          {archivedChats.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold ${lightMuted} hover:text-gray-400 transition-colors mb-1 px-1`}
              >
                <Archive size={10} />
                Archived ({archivedChats.length})
                <ChevronDown size={10} className={`transition-transform ${showArchived ? "rotate-180" : ""}`} />
              </button>
              {showArchived && archivedChats.map((chat) => (
                <div key={chat.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl ${darkMode ? "hover:bg-white/5" : "hover:bg-gray-50"} mb-0.5`}>
                  <Archive size={10} className={lightMuted + " shrink-0"} />
                  <span className={`flex-1 truncate text-xs ${lightMuted}`}>{chat.title}</span>
                  <button onClick={() => archiveChat(chat.id)} className={`p-1 rounded text-xs ${lightMuted} hover:text-white transition-colors`}>↩</button>
                  <button onClick={() => deleteChat(chat.id)} className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dark mode toggle */}
        <div className={`px-4 py-3 border-t ${lightBorder} shrink-0`}>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${darkMode ? "hover:bg-white/5 text-[#9a9ab8]" : "hover:bg-gray-100 text-[#666690]"}`}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            <span className="text-xs font-medium">{darkMode ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <section className="relative flex flex-1 flex-col overflow-hidden min-w-0">

        {/* TOPBAR */}
        <div className={`flex items-center gap-2 px-3 sm:px-4 py-3 border-b ${lightBorder} ${darkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/80 backdrop-blur-xl"} shrink-0 relative z-10`}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`shrink-0 p-2 rounded-xl border ${lightBorder} ${darkMode ? "bg-white/5 hover:bg-white/10 text-[#9a9ab8]" : "bg-gray-100 hover:bg-gray-200 text-gray-500"} transition-colors`}
          >
            {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
          </button>

          {/* Breadcrumb / title */}
          <div className={`flex-1 text-sm font-semibold truncate min-w-0 ${lightText}`}>
            {activeTool === "chat"
              ? (currentChat?.title || "Chat")
              : TOOL_CONFIG.find((t) => t.id === activeTool)?.label || ""}
          </div>

          {/* Mode selector — chat only */}
          {activeTool === "chat" && (
            <div ref={modeRef} className="relative shrink-0">
              <button
                onClick={() => setModeDropdown(!modeDropdown)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-all bg-linear-to-r ${currentMode.color}`}
              >
                <span>{currentMode.icon}</span>
                <span className="hidden sm:inline">{currentMode.label}</span>
                <ChevronDown size={11} className={`transition-transform ${modeDropdown ? "rotate-180" : ""}`} />
              </button>

              {modeDropdown && (
                <div className={`absolute right-0 top-10 z-50 w-52 rounded-xl border ${lightBorder} ${darkMode ? "bg-[#0e0e1e]" : "bg-white"} shadow-2xl overflow-hidden animate-fade-in`}>
                  {(Object.keys(MODE_CONFIG) as Mode[]).map((m) => {
                    const cfg = MODE_CONFIG[m];
                    return (
                      <button
                        key={m}
                        onClick={() => { setMode(m); setModeDropdown(false); }}
                        className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors ${darkMode ? "hover:bg-white/5" : "hover:bg-gray-50"} ${mode === m ? (darkMode ? "bg-white/5" : "bg-violet-50") : ""}`}
                      >
                        <span className="text-base">{cfg.icon}</span>
                        <div>
                          <div className={`text-xs font-semibold ${lightText}`}>{cfg.label}</div>
                          <div className={`text-[11px] ${lightMuted}`}>{cfg.desc}</div>
                        </div>
                        {mode === m && <Check size={13} className="ml-auto text-violet-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
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
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 sm:py-7 space-y-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 animate-in ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 shadow-md
                    ${msg.role === "user"
                      ? "bg-linear-to-br from-violet-600 to-violet-500"
                      : "bg-linear-to-br from-violet-600 to-cyan-500"}`}>
                    {msg.role === "user" ? "👤" : "✦"}
                  </div>

                  <div className={`max-w-[87%] sm:max-w-[78%] flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    {/* Image */}
                    {msg.role === "user" && msg.imageUrl && (
                      <div className="rounded-2xl overflow-hidden border border-violet-500/30 shadow-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={msg.imageUrl} alt="Uploaded" className="max-w-52 sm:max-w-64 max-h-48 object-cover block" />
                      </div>
                    )}

                    {/* Doc chip */}
                    {msg.role === "user" && msg.fileName && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-600/20 border border-violet-500/30 rounded-xl text-xs text-violet-300">
                        <FileText size={12} className="shrink-0" />
                        <span className="truncate max-w-44 font-medium">{msg.fileName}</span>
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 shadow-lg
                      ${msg.role === "user"
                        ? "bg-linear-to-br from-violet-600 to-violet-500 text-white rounded-tr-md"
                        : `${darkMode ? "bg-black/40 border border-white/8" : "bg-white border border-gray-100 shadow-sm"} rounded-tl-md`}`}>
                      {msg.role === "user" ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.fileName
                            ? (msg.content.includes(`[Document: ${msg.fileName}]`)
                                ? msg.content.split(`[Document: ${msg.fileName}]`)[0].trim() || `Shared document: ${msg.fileName}`
                                : msg.content.split("Please analyse this document")[0].trim() || `Shared: ${msg.fileName}`)
                            : msg.content}
                        </p>
                      ) : (
                        <ChatBubble role={msg.role} content={msg.content} darkMode={darkMode} />
                      )}
                    </div>

                    {/* Message actions */}
                    {msg.role === "assistant" && msg.content && (
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <button
                          onClick={() => copyMsg(msg.content, i)}
                          className={`flex items-center gap-1 text-[11px] px-2.5 py-1 border rounded-lg transition-all
                            ${copiedMsgIdx === i
                              ? "bg-green-600/20 border-green-500/40 text-green-400"
                              : `${darkMode ? "bg-white/5 border-white/10 text-[#9a9ab8] hover:text-white" : "bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-800"}`}`}
                        >
                          {copiedMsgIdx === i ? <><Check size={10} /> Copied</> : "Copy"}
                        </button>
                        <button
                          onClick={() => setActiveTool("flashcards")}
                          className={`text-[11px] px-2.5 py-1 border rounded-lg transition-all ${darkMode ? "bg-white/5 border-white/10 text-[#9a9ab8] hover:text-white" : "bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-800"}`}
                        >Flashcards</button>
                        <button
                          onClick={() => { localStorage.setItem("studyai-new-note", JSON.stringify({ title: "AI Response", body: msg.content })); setActiveTool("notes"); }}
                          className={`text-[11px] px-2.5 py-1 border rounded-lg transition-all ${darkMode ? "bg-white/5 border-white/10 text-[#9a9ab8] hover:text-white" : "bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-800"}`}
                        >Save as Note</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3 animate-in">
                  <div className="w-8 h-8 rounded-full bg-linear-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-sm shrink-0 shadow-md">✦</div>
                  <div className={`${darkMode ? "bg-black/40 border-white/8" : "bg-white border-gray-100"} border rounded-2xl rounded-tl-md px-5 py-4 shadow-lg`}>
                    <TypingLoader />
                  </div>
                </div>
              )}
            </div>

            {/* INPUT AREA */}
            <div className={`px-3 sm:px-5 pb-4 sm:pb-5 pt-2 sm:pt-3 ${darkMode ? "bg-black/10 backdrop-blur-xl" : "bg-white/90 backdrop-blur-xl border-t border-gray-100"} shrink-0`}>
              {/* Quick prompts */}
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setInput(p); inputRef.current?.focus(); }}
                    className={`shrink-0 px-3 py-1.5 border rounded-full text-xs font-medium transition-all whitespace-nowrap
                      ${darkMode
                        ? "bg-white/4 hover:bg-violet-600/15 border-white/8 hover:border-violet-500/40 text-[#9a9ab8] hover:text-violet-300"
                        : "bg-gray-100 hover:bg-violet-50 border-gray-200 hover:border-violet-300 text-gray-500 hover:text-violet-600"}`}
                  >{p}</button>
                ))}
              </div>

              {/* Attachment preview */}
              {(attachment || extracting) && (
                <div className="mb-3 flex items-start gap-3">
                  {extracting && (
                    <div className={`flex items-center gap-2 px-3 py-2 ${darkMode ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"} border rounded-xl text-xs ${lightMuted} animate-pulse-soft`}>
                      <FileText size={13} /> Reading document…
                    </div>
                  )}
                  {attachment?.kind === "image" && (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={attachment.previewUrl} alt="To send"
                        className="h-16 w-auto max-w-36 rounded-xl object-cover border border-violet-500/40 shadow-md" />
                      <button onClick={clearAttachment}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow-md hover:bg-red-400">✕</button>
                    </div>
                  )}
                  {attachment?.kind === "doc" && (
                    <div className={`flex items-center gap-2 px-3 py-2 ${darkMode ? "bg-violet-600/12 border-violet-500/25" : "bg-violet-50 border-violet-200"} border rounded-xl`}>
                      <FileText size={13} className="text-violet-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-violet-400 truncate max-w-44">{attachment.file.name}</p>
                        <p className={`text-[10px] ${lightMuted}`}>{attachment.extractedText.split(/\s+/).filter(Boolean).length.toLocaleString()} words</p>
                      </div>
                      <button onClick={clearAttachment} className={`p-1 rounded-lg ${lightMuted} hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1 shrink-0`}>
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Input row */}
              <div className={`flex items-end gap-2 sm:gap-3 ${darkMode ? "bg-white/5 border-white/10 focus-within:border-violet-500/45" : "bg-white border-gray-200 focus-within:border-violet-400 shadow-sm"} border rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 transition-colors`}>
                <label className={`shrink-0 cursor-pointer transition-colors ${attachment ? "text-violet-400" : `${lightMuted} hover:text-violet-400`}`} title="Attach image, PDF, or document">
                  <Paperclip size={18} />
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
                </label>

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={handleKey}
                  placeholder={
                    extracting ? "Reading document…"
                    : attachment?.kind === "doc"   ? `Ask anything about ${attachment.file.name}…`
                    : attachment?.kind === "image" ? "Add a message about this image… (optional)"
                    : "Ask anything… or attach a file"
                  }
                  rows={1}
                  disabled={extracting}
                  className={`flex-1 bg-transparent outline-none text-sm resize-none leading-6 max-h-36 disabled:opacity-50 ${lightText} placeholder:${lightMuted}`}
                />

                <button
                  onClick={sendMessage}
                  disabled={!canSend}
                  className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 disabled:opacity-35 disabled:scale-100 disabled:cursor-not-allowed"
                  style={{ background: canSend ? "linear-gradient(135deg,#7c5af0,#22d3ee)" : "rgba(124,90,240,0.3)" }}
                >
                  <Send size={15} />
                </button>
              </div>

              <p className={`text-center text-[10px] ${lightMuted} mt-2`}>
                StudyAI can make mistakes. Verify important information.
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
