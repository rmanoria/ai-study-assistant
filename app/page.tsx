"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, ImagePlus, Plus, MessageSquare, Trash2,
  Pencil, Pin, Archive, Star, Menu, X, FileText, Paperclip,
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
  fileName?: string;  // for PDF/doc attachments shown in bubble
};
type Chat = {
  id: string; title: string; messages: Message[];
  pinned?: boolean; archived?: boolean; highlighted?: boolean;
};
type Tool = "chat" | "flashcards" | "quiz" | "notes" | "summarizer" | "planner";
type Mode = "quick" | "deep" | "research";

// Attachment can be image OR document
type Attachment =
  | { kind: "image"; file: File; previewUrl: string }
  | { kind: "doc";   file: File; extractedText: string };

const TOOL_CONFIG: { id: Tool; emoji: string; label: string }[] = [
  { id: "flashcards", emoji: "🃏", label: "Flashcards" },
  { id: "quiz",       emoji: "🧠", label: "Quiz" },
  { id: "notes",      emoji: "📝", label: "Notes" },
  { id: "summarizer", emoji: "⚡", label: "Summarizer" },
  { id: "planner",    emoji: "📅", label: "Planner" },
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

// ── PDF/DOCX text extraction ─────────────────────────────────
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const ab  = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(ab) }).promise;
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
  if (n.endsWith(".pdf"))  return extractPdfText(file);
  if (n.endsWith(".docx") || n.endsWith(".doc")) return extractDocxText(file);
  // txt
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

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export default function Home() {
  const { isSignedIn } = useUser();

  const [chats, setChats]               = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [activeTool, setActiveTool]     = useState<Tool>("chat");
  const [sidebarOpen, setSidebarOpen]   = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true);
  }, []);

  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [mode, setMode]             = useState<Mode>("quick");
  const [autoScroll, setAutoScroll] = useState(true);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLTextAreaElement>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);

  // Load chats
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

  // Revoke image preview URLs on change
  useEffect(() => {
    return () => {
      if (attachment?.kind === "image") URL.revokeObjectURL(attachment.previewUrl);
    };
  }, [attachment]);

  async function handleFileSelect(file: File) {
    // Revoke old preview if image
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

  function createChatObj(): Chat {
    return { id: Date.now().toString(), title: "New Chat", messages: [...STARTERS] };
  }

  function newChat() {
    const chat = createChatObj();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setActiveTool("chat");
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  function deleteChat(id: string) {
    setChats((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      if (activeChatId === id && updated.length > 0) setActiveChatId(updated[0].id);
      return updated;
    });
  }

  function renameChat(id: string) {
    const t = prompt("Rename chat:");
    if (!t) return;
    setChats((prev) => prev.map((c) => c.id === id ? { ...c, title: t } : c));
  }

  function pinChat(id: string) {
    setChats((prev) => prev.map((c) => c.id === id ? { ...c, pinned: !c.pinned } : c));
  }

  function archiveChat(id: string) {
    setChats((prev) => prev.map((c) => c.id === id ? { ...c, archived: !c.archived } : c));
  }

  function highlightChat(id: string) {
    setChats((prev) => prev.map((c) => c.id === id ? { ...c, highlighted: !c.highlighted } : c));
  }

  const currentChat = chats.find((c) => c.id === activeChatId);
  const messages    = currentChat?.messages || [];

  const sendToChat = useCallback((text: string) => {
    setActiveTool("chat");
    setInput(text);
    inputRef.current?.focus();
  }, []);

  async function sendMessage() {
    const hasText = input.trim().length > 0;
    const hasFile = attachment !== null;
    if (!hasText && !hasFile) return;

    // Build user message content
    let userContent = input.trim();
    let fileName: string | undefined;
    let imageUrl: string | undefined;
    const imageFile = attachment?.kind === "image" ? attachment.file : null;
    imageUrl        = attachment?.kind === "image" ? attachment.previewUrl : undefined;

    if (attachment?.kind === "doc") {
      fileName    = attachment.file.name;
      const excerpt = attachment.extractedText.slice(0, 12000); // send up to 12k chars
      userContent = userContent
        ? `${userContent}\n\n[Document: ${fileName}]\n\n${excerpt}`
        : `Please analyze this document — "${fileName}" — and respond to any questions about it.\n\n${excerpt}`;
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
          ? (input.trim() || fileName || "Document").slice(0, 28) + "…"
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
      // Strip imageUrl/fileName from messages sent to server (not needed server-side)
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

  const sortedChats   = [...chats].filter((c) => !c.archived).sort((a, b) => (a.pinned ? -1 : b.pinned ? 1 : 0));
  const archivedChats = chats.filter((c) => c.archived);
  const canSend       = !loading && !extracting && (input.trim().length > 0 || attachment !== null);

  return (
    <main className="relative flex h-screen overflow-hidden bg-transparent text-white">
      <AnimatedBackground />

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed md:relative z-50 h-full flex flex-col border-r border-white/8 backdrop-blur-2xl transition-transform duration-300
        w-72 md:w-64
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-full md:w-0 md:overflow-hidden"}
        bg-black/90 md:bg-black/50
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

        {/* New Chat */}
        <div className="px-4 py-3 shrink-0">
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold transition-all"
          >
            <Plus size={15} /> New Chat
          </button>
        </div>

        {/* Study Tools */}
        <div className="px-4 pb-2 shrink-0">
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

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-1.5">Chats</p>
          <div className="flex flex-col gap-0.5">
            {sortedChats.map((chat) => (
              <div
                key={chat.id}
                className={`group rounded-xl p-2.5 transition-all cursor-pointer
                  ${activeChatId === chat.id && activeTool === "chat" ? "bg-violet-600/30 border border-violet-500/30" : "hover:bg-white/5"}
                  ${chat.highlighted ? "ring-1 ring-yellow-500/40" : ""}`}
              >
                <button
                  onClick={() => {
                    setActiveChatId(chat.id); setActiveTool("chat");
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    {chat.pinned && <Pin size={10} className="text-amber-400 shrink-0" />}
                    <MessageSquare size={12} className="text-gray-500 shrink-0" />
                    <span className="truncate text-xs text-gray-300">{chat.title}</span>
                  </div>
                </button>
                <div className="hidden group-hover:flex gap-1 mt-1.5">
                  {[
                    { icon: <Pin size={10} />,     fn: () => pinChat(chat.id) },
                    { icon: <Archive size={10} />, fn: () => archiveChat(chat.id) },
                    { icon: <Star size={10} />,    fn: () => highlightChat(chat.id) },
                    { icon: <Pencil size={10} />,  fn: () => renameChat(chat.id) },
                  ].map((btn, i) => (
                    <button key={i} onClick={btn.fn} className="p-1 rounded hover:bg-white/10 text-gray-400">{btn.icon}</button>
                  ))}
                  <button onClick={() => deleteChat(chat.id)} className="p-1 rounded hover:bg-red-500/20 text-red-400"><Trash2 size={10} /></button>
                </div>
              </div>
            ))}
          </div>

          {archivedChats.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-1.5">Archived</p>
              {archivedChats.map((chat) => (
                <div key={chat.id} className="group flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer">
                  <Archive size={11} className="text-gray-600 shrink-0" />
                  <span className="flex-1 truncate text-xs text-gray-500">{chat.title}</span>
                  <button onClick={() => archiveChat(chat.id)} className="hidden group-hover:block p-1 hover:bg-white/10 rounded text-xs text-gray-400">↩</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
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
            <div className="flex gap-1 sm:gap-1.5 shrink-0">
              {(["quick", "deep", "research"] as Mode[]).map((m) => {
                const cfg = {
                  quick:    { label: "⚡ Quick",    icon: "⚡", active: "bg-violet-600" },
                  deep:     { label: "🧠 Deep",     icon: "🧠", active: "bg-purple-700" },
                  research: { label: "🔬 Research", icon: "🔬", active: "bg-green-700" },
                }[m];
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-full font-bold border transition-all px-2 py-1.5 text-sm md:px-3 md:text-[11px]
                      ${mode === m
                        ? `${cfg.active} border-transparent text-white`
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
            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""} group`}>
                  {/* Avatar */}
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm shrink-0 mt-0.5
                    ${msg.role === "user" ? "bg-violet-600" : "bg-linear-to-br from-violet-500 to-cyan-500"}`}>
                    {msg.role === "user" ? "👤" : "✦"}
                  </div>

                  <div className={`max-w-[85%] sm:max-w-[80%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>

                    {/* Image attachment */}
                    {msg.role === "user" && msg.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-violet-500/30 shadow-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={msg.imageUrl} alt="Uploaded" className="max-w-55 sm:max-w-65 max-h-45 sm:max-h-50 object-cover block" />
                      </div>
                    )}

                    {/* Document attachment chip */}
                    {msg.role === "user" && msg.fileName && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-violet-600/20 border border-violet-500/30 rounded-xl text-xs text-violet-300">
                        <FileText size={13} className="shrink-0" />
                        <span className="truncate max-w-40 font-medium">{msg.fileName}</span>
                      </div>
                    )}

                    {/* Bubble — show text content, but hide the injected doc text */}
                    <div className={`rounded-2xl px-4 py-3 sm:px-5 sm:py-4 shadow-lg transition-all
                      ${msg.role === "user"
                        ? "bg-violet-600 text-white rounded-tr-sm"
                        : "bg-black/40 border border-white/10 backdrop-blur-xl rounded-tl-sm"
                      }`}>
                      {msg.role === "user" ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {/* Strip the injected doc content from display */}
                          {msg.fileName
                            ? (msg.content.includes(`[Document: ${msg.fileName}]`)
                                ? msg.content.split(`[Document: ${msg.fileName}]`)[0].trim() || `Shared document: ${msg.fileName}`
                                : msg.content.split(`Please analyze this document`)[0].trim() || `Shared: ${msg.fileName}`)
                            : msg.content
                          }
                        </p>
                      ) : (
                        <ChatBubble role={msg.role} content={msg.content} darkMode={true} />
                      )}
                    </div>

                    {/* Message actions */}
                    {msg.role === "assistant" && (
                      <div className="flex gap-1.5 sm:gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                        <button
                          onClick={() => navigator.clipboard?.writeText(msg.content)}
                          className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                        >📋 Copy</button>
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
                    <div className="relative group/img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={attachment.previewUrl}
                        alt="To send"
                        className="h-16 sm:h-20 w-auto max-w-30 sm:max-w-40 rounded-xl object-cover border border-violet-500/40 shadow-md"
                      />
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
                {/* Attach button — images + docs */}
                <label className={`shrink-0 p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all
                  ${attachment
                    ? "bg-violet-600/20 border-violet-500/50 text-violet-400"
                    : "bg-white/5 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white"
                  }`}
                  title="Attach image, PDF, or document"
                >
                  <Paperclip size={17} />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }}
                  />
                </label>

                {/* Text input */}
                <div className="flex-1 bg-white/5 border border-white/10 focus-within:border-violet-500/50 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 transition-colors min-w-0">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                    onKeyDown={handleKey}
                    placeholder={
                      extracting ? "Reading document…"
                      : attachment?.kind === "doc" ? `Ask anything about ${attachment.file.name}…`
                      : attachment?.kind === "image" ? "Add a message about this image… (optional)"
                      : "Ask anything… or attach a PDF / image"
                    }
                    rows={1}
                    disabled={extracting}
                    className="w-full bg-transparent outline-none text-white placeholder:text-gray-500 text-sm resize-none leading-6 max-h-28 disabled:opacity-50"
                  />
                </div>

                {/* Send */}
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
