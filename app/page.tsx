
"use client";
import {
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import {
  useState,
  useEffect,
  useRef,
} from "react";

import AnimatedBackground from "./components/AnimatedBackground";
import ChatBubble from "./components/ChatBubble";
import TypingLoader from "./components/TypingLoader";

import {
  Send,
  ImagePlus,
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Pin,
  Archive,
  Star,
  Menu,
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  pinned?: boolean;
  archived?: boolean;
  highlighted?: boolean;
};

export default function Home() {
  const { isSignedIn } = useUser();
  // STARTER MESSAGE
  const starterMessages: Message[] = [
    {
      role: "assistant",
      content:
        "# Welcome to AI Study Assistant 🚀\n\nAsk me anything about school, coding, science, or research.",
    },
  ];

  // STATES
  const [chats, setChats] = useState<Chat[]>([
    {
      id: Date.now().toString(),
      title: "New Chat",
      messages: starterMessages,
    },
  ]);
const [sidebarOpen, setSidebarOpen] =
  useState(false);
  const [activeChatId, setActiveChatId] =
    useState(chats[0].id);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [image, setImage] =
    useState<File | null>(null);

  const [mode, setMode] =
    useState("quick");

  const [darkMode, setDarkMode] =
    useState(true);

  const [autoScroll, setAutoScroll] =
    useState(true);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  const chatContainerRef =
    useRef<HTMLDivElement>(null);

  // CURRENT CHAT
  const currentChat =
    chats.find(
      (chat) => chat.id === activeChatId
    ) || chats[0];

  const messages =
    currentChat?.messages || [];

  // AUTO SCROLL DETECTION
  useEffect(() => {
    const container =
      chatContainerRef.current;

    if (!container) return;

    const handleScroll = () => {
      const nearBottom =
        container.scrollHeight -
          container.scrollTop -
          container.clientHeight <
        150;

      setAutoScroll(nearBottom);
    };

    container.addEventListener(
      "scroll",
      handleScroll
    );

    return () =>
      container.removeEventListener(
        "scroll",
        handleScroll
      );
  }, []);

  // AUTO SCROLL
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [messages, loading, autoScroll]);

  // LOAD SAVED CHATS
  useEffect(() => {
    const savedChats =
      localStorage.getItem(
        "ai-study-chats"
      );

    if (savedChats) {
      const parsedChats =
        JSON.parse(savedChats);

      setChats(parsedChats);

      if (parsedChats.length > 0) {
        setActiveChatId(
          parsedChats[0].id
        );
      }
    }
  }, []);

  // SAVE CHATS
  useEffect(() => {
    localStorage.setItem(
      "ai-study-chats",
      JSON.stringify(chats)
    );
  }, [chats]);

  // CREATE CHAT
  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: starterMessages,
    };

    setChats((prev) => [
      newChat,
      ...prev,
    ]);

    setActiveChatId(newChat.id);
  };

  // DELETE CHAT
  const deleteChat = (
    id: string
  ) => {
    const updatedChats =
      chats.filter(
        (chat) => chat.id !== id
      );

    setChats(updatedChats);

    if (updatedChats.length > 0) {
      setActiveChatId(
        updatedChats[0].id
      );
    }
  };

  // RENAME CHAT
  const renameChat = (
    id: string
  ) => {
    const newTitle = prompt(
      "Rename chat:"
    );

    if (!newTitle) return;

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              title: newTitle,
            }
          : chat
      )
    );
  };

  // PIN CHAT
  const pinChat = (id: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              pinned:
                !chat.pinned,
            }
          : chat
      )
    );
  };

  // ARCHIVE CHAT
  const archiveChat = (
    id: string
  ) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              archived:
                !chat.archived,
            }
          : chat
      )
    );
  };

  // HIGHLIGHT CHAT
  const highlightChat = (
    id: string
  ) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id
          ? {
              ...chat,
              highlighted:
                !chat.highlighted,
            }
          : chat
      )
    );
  };

  // SEND MESSAGE
  const sendMessage = async () => {
    if (!input.trim() && !image)
      return;

    const userMessage =
      input.trim() ||
      "Explain this image";

    const newMessages: Message[] = [
      ...messages,
      {
        role: "user",
        content: userMessage,
      },
    ];

    // UPDATE CHAT
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              title:
                chat.title ===
                "New Chat"
                  ? userMessage.slice(
                      0,
                      25
                    )
                  : chat.title,
              messages: newMessages,
            }
          : chat
      )
    );

    setInput("");
    setLoading(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "messages",
        JSON.stringify(newMessages)
      );

      formData.append("mode", mode);

      if (image instanceof File) {
        formData.append(
          "image",
          image
        );
      }

      const res = await fetch(
        "/api/chat",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      const fullReply =
        data.reply ||
        "No response returned.";

      // EMPTY ASSISTANT MESSAGE
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  {
                    role:
                      "assistant",
                    content: "",
                  },
                ],
              }
            : chat
        )
      );

      let typedText = "";

      for (
        let i = 0;
        i < fullReply.length;
        i++
      ) {
        typedText += fullReply[i];

        if (i % 40 === 0) {
          setChats((prev) =>
            prev.map((chat) => {
              if (
                chat.id !==
                activeChatId
              )
                return chat;

              const updatedMessages =
                [
                  ...chat.messages,
                ];

              updatedMessages[
                updatedMessages.length -
                  1
              ] = {
                role: "assistant",
                content:
                  typedText,
              };

              return {
                ...chat,
                messages:
                  updatedMessages,
              };
            })
          );

          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                0
              )
          );
        }
      }

      // FINAL FULL RESPONSE
      setChats((prev) =>
        prev.map((chat) => {
          if (
            chat.id !==
            activeChatId
          )
            return chat;

          const updatedMessages =
            [...chat.messages];

          updatedMessages[
            updatedMessages.length - 1
          ] = {
            role: "assistant",
            content: fullReply,
          };

          return {
            ...chat,
            messages:
              updatedMessages,
          };
        })
      );
    } catch (error) {
      setChats((prev) =>
        prev.map((chat) => {
          if (
            chat.id !==
            activeChatId
          )
            return chat;

          return {
            ...chat,
            messages: [
              ...chat.messages,
              {
                role: "assistant",
                content:
                  "Something went wrong 😢",
              },
            ],
          };
        })
      );
    } finally {
      setLoading(false);
      setImage(null);
    }
  };

  return (
   <main
  className={`relative flex h-screen overflow-hidden transition-all duration-500 ${
        darkMode
          ? "bg-black text-white"
          : "bg-[#eef2ff] text-black"
      }`}
    >
      <AnimatedBackground />

      {/* SIDEBAR */}
     <aside
  className={`fixed md:relative z-50 h-full w-80 flex flex-col border-r transition-all duration-300 ${
    sidebarOpen
      ? "translate-x-0"
      : "-translate-x-full md:translate-x-0"
  } ${
          darkMode
            ? "border-white/10 bg-black/40 backdrop-blur-2xl"
            : "border-white/40 bg-white/60 backdrop-blur-2xl shadow-2xl"
        }`}
      >
        {/* LOGO */}
        <div className="p-6 border-b border-white/10">
          <h1 className="text-3xl font-black tracking-tight">
            AI Study Assistant
          </h1>

          <p
            className={`mt-2 text-sm ${
              darkMode
                ? "text-gray-400"
                : "text-gray-700"
            }`}
          >
            Smart AI learning platform
          </p>
        </div>
{/* AUTH */}
<div className="px-4 pb-4">
  {!isSignedIn ? (
    <div
      className={`relative overflow-hidden rounded-3xl border p-5 transition-all ${
        darkMode
          ? "bg-white/5 border-white/10 backdrop-blur-2xl"
          : "bg-white/70 border-white/40 backdrop-blur-2xl shadow-xl"
      }`}
    >
      {/* Glow */}
      <div className="absolute inset-0 bg-linear-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 animate-pulse" />

      <div className="relative z-10">
        <h2 className="text-md font-bold">
          Welcome Back ✨
        </h2>

        <p
          className={`text-sm mt-1 ${
            darkMode
              ? "text-gray-400"
              : "text-gray-600"
          }`}
        >
          Sign in to sync chats and unlock your AI workspace.
        </p>

        <SignInButton mode="modal">
          <button className="mt-4 w-full rounded-2xl bg-linear-to-r from-blue-600 via-purple-600 to-cyan-500 px-4 py-3 font-semibold text-white shadow-2xl transition-all hover:scale-[1.03] hover:shadow-blue-500/30">
            🚀 Continue with Clerk
          </button>
        </SignInButton>
      </div>
    </div>
  ) : (
    <div
      className={`rounded-3xl border p-4 flex items-center justify-between transition-all ${
        darkMode
          ? "bg-white/5 border-white/10 backdrop-blur-2xl"
          : "bg-white/70 border-white/40 backdrop-blur-2xl shadow-xl"
      }`}
    >
      <div>
        <h2 className="font-semibold">
          You’re signed in ✨
        </h2>

        <p
          className={`text-sm ${
            darkMode
              ? "text-gray-400"
              : "text-gray-600"
          }`}
        >
          Your chats are now personalized
        </p>
      </div>

      <div className="scale-110">
        <UserButton />
      </div>
    </div>
  )}
</div>
        {/* NEW CHAT */}
        <div className="p-4">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 px-4 py-4 font-semibold transition-all shadow-xl hover:scale-[1.02]"
          >
            <Plus size={20} />
            New Chat
          </button>
        </div>
       

        {/* CHAT HISTORY */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3">
          {chats
            .filter(
              (chat) =>
                !chat.archived
            )
            .sort((a, b) =>
              a.pinned
                ? -1
                : b.pinned
                ? 1
                : 0
            )
            .map((chat) => (
              <div
                key={chat.id}
                className={`rounded-2xl p-3 transition-all ${
                  activeChatId ===
                  chat.id
                    ? darkMode
                      ? "bg-blue-600"
                      : "bg-white border border-gray-200 shadow-xl"
                    : darkMode
                    ? "bg-white/5"
                    : "bg-white/70 shadow-md"
                } ${
                  chat.highlighted
                    ? "ring-2 ring-yellow-400"
                    : ""
                }`}
              >
                <button
                  onClick={() =>
                    setActiveChatId(
                      chat.id
                    )
                  }
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare
                      size={16}
                    />

                    <span className="truncate">
                      {chat.title}
                    </span>
                  </div>
                </button>
                {/* ARCHIVED CHATS */}
<div className="px-4 pb-4">
  <h2
    className={`text-xs uppercase mb-3 ${
      darkMode
        ? "text-gray-400"
        : "text-gray-600"
    }`}
  >
    Archived
  </h2>

  <div className="space-y-3">
    {chats
      .filter((chat) => chat.archived)
      .map((chat) => (
        <div
          key={chat.id}
          className={`rounded-2xl p-3 transition-all ${
            darkMode
              ? "bg-white/5"
              : "bg-white/70 shadow-md"
          }`}
        >
          {/* CHAT BUTTON */}
          <button
            onClick={() =>
              setActiveChatId(chat.id)
            }
            className="w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Archive size={16} />

              <span className="truncate">
                {chat.title}
              </span>
            </div>
          </button>

          {/* ACTIONS */}
          <div className="flex gap-2 mt-3">
            {/* RESTORE */}
            <button
              onClick={() =>
                archiveChat(chat.id)
              }
              className="p-2 rounded-lg hover:bg-white/10"
            >
              <Archive size={14} />
            </button>

            {/* DELETE */}
            <button
              onClick={() =>
                deleteChat(chat.id)
              }
              className="p-2 rounded-lg hover:bg-red-500/20"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
  </div>
</div>

                {/* ACTIONS */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() =>
                      pinChat(
                        chat.id
                      )
                    }
                  >
                    <Pin size={14} />
                  </button>

                  <button
                    onClick={() =>
                      archiveChat(
                        chat.id
                      )
                    }
                  >
                    <Archive
                      size={14}
                    />
                  </button>

                  <button
                    onClick={() =>
                      highlightChat(
                        chat.id
                      )
                    }
                  >
                    <Star size={14} />
                  </button>

                  <button
                    onClick={() =>
                      renameChat(
                        chat.id
                      )
                    }
                  >
                    <Pencil
                      size={14}
                    />
                  </button>

                  <button
                    onClick={() =>
                      deleteChat(
                        chat.id
                      )
                    }
                  >
                    <Trash2
                      size={14}
                    />
                  </button>
                </div>
              </div>
            ))}
        </div>

        {/* DARK MODE */}
        <div className="p-5">
          <button
            onClick={() =>
              setDarkMode(
                !darkMode
              )
            }
            className={`w-full rounded-2xl px-4 py-3 font-medium transition-all ${
              darkMode
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-black text-white hover:bg-zinc-800 shadow-lg"
            }`}
          >
            {darkMode
              ? "☀️ Light Mode"
              : "🌙 Dark Mode"}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <section className="flex-1 flex flex-col">
        <div className="md:hidden p-4">
  <button
    onClick={() =>
      setSidebarOpen(!sidebarOpen)
    }
    className="p-3 rounded-xl bg-white/10"
  >
    <Menu size={24} />
  </button>
</div>
        {/* CHAT AREA */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {messages.map(
            (msg, index) => (
              <div
                key={index}
                className={`max-w-[85%] rounded-3xl p-5 transition-all shadow-xl ${
                  msg.role ===
                  "user"
                    ? "bg-blue-600 text-white ml-auto"
                    : darkMode
                    ? "bg-zinc-900 border border-white/10 text-white"
                    : "bg-white border border-gray-200 text-black"
                }`}
              >
               <ChatBubble
  role={msg.role}
  content={msg.content}
  darkMode={darkMode}
/>
              </div>
            )
          )}

          {loading && (
            <TypingLoader />
          )}

          <div ref={bottomRef} />
        </div>

        {/* INPUT AREA */}
        <div
          className={`p-5 border-t transition-all duration-500 ${
            darkMode
              ? "border-white/10 bg-black/50 backdrop-blur-2xl"
              : "border-white/50 bg-white/70 backdrop-blur-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)]"
          }`}
        >
          {/* MODES */}
          <div className="flex gap-3 mb-5 max-w-5xl mx-auto flex-wrap">
            {["quick", "deep", "research"].map(
              (item) => (
                <button
                  key={item}
                  onClick={() =>
                    setMode(item)
                  }
                  className={`px-5 py-3 rounded-2xl font-medium transition-all shadow-xl ${
                    mode === item
                      ? item ===
                        "quick"
                        ? "bg-blue-600 text-white scale-105"
                        : item ===
                          "deep"
                        ? "bg-purple-600 text-white scale-105"
                        : "bg-green-600 text-white scale-105"
                      : darkMode
                      ? "bg-white/10 hover:bg-white/20"
                      : "bg-white hover:shadow-lg border border-gray-200"
                  }`}
                >
                  {item ===
                    "quick" &&
                    "⚡ Quick"}

                  {item ===
                    "deep" &&
                    "🧠 Deep"}

                  {item ===
                    "research" &&
                    "🌐 Research"}
                </button>
              )
            )}

            {/* IMAGE */}
            <label
              className={`cursor-pointer rounded-2xl px-5 flex items-center justify-center transition-all shadow-xl ${
                darkMode
                  ? "bg-white/10 hover:bg-white/20"
                  : "bg-white border border-gray-200 hover:shadow-lg"
              }`}
            >
              <ImagePlus />

              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  if (
                    e.target
                      .files?.[0]
                  ) {
                    setImage(
                      e.target
                        .files[0]
                    );
                  }
                }}
              />
            </label>

            {image && (
              <div
                className={`flex items-center text-sm px-4 rounded-2xl ${
                  darkMode
                    ? "text-gray-300"
                    : "text-gray-700"
                }`}
              >
                📷 {image.name}
              </div>
            )}
          </div>

          {/* INPUT */}
          <div className="flex gap-3 max-w-5xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) =>
                setInput(
                  e.target.value
                )
              }
              placeholder="Ask anything..."
              className={`flex-1 rounded-3xl px-6 py-5 outline-none transition-all ${
                darkMode
                  ? "bg-white/10 border border-white/10 text-white placeholder:text-gray-400 focus:border-blue-500"
                  : "bg-white border border-gray-300 text-black placeholder:text-gray-500 shadow-lg focus:border-blue-500"
              }`}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  sendMessage();
                }
              }}
            />

            <button
              onClick={sendMessage}
              className="rounded-3xl bg-blue-600 hover:bg-blue-700 px-6 transition-all shadow-2xl hover:scale-105"
            >
              <Send />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}