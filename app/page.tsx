"use client";

import { useState } from "react";
import AnimatedBackground from "./components/AnimatedBackground";
import ChatBubble from "./components/ChatBubble";
import TypingLoader from "./components/TypingLoader";
import { Send } from "lucide-react";
import { ImagePlus } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "# Welcome to AI Study Assistant 🚀\n\nAsk me anything about school, coding, science, or research.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [mode, setMode] = useState("quick");

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessages: Message[] = [
      ...messages,
      {
        role: "user",
        content: input,
      },
    ];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const formData = new FormData();

formData.append(
  "messages",
  JSON.stringify(newMessages)
);

formData.append("mode", mode);

if (image) {
  formData.append("image", image);
}

const res = await fetch("/api/chat", {
  method: "POST",
  body: formData,
});
      

      const data = await res.json();

      const fullReply = data.reply;

let currentText = "";

setMessages((prev) => [
  ...prev,
  {
    role: "assistant",
    content: "",
  },
]);

for (let i = 0; i < fullReply.length; i++) {
  currentText += fullReply[i];

  await new Promise((resolve) =>
    setTimeout(resolve, 10)
  );

  setMessages((prev) => {
    const updated = [...prev];

    updated[updated.length - 1] = {
      role: "assistant",
      content: currentText,
    };

    return updated;
  });
}
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong 😢",
        },
      ]);
    }

    setLoading(false);
  };

  return (
    <main className="relative flex h-screen overflow-hidden bg-black text-white">
      <AnimatedBackground />

      <aside className="hidden md:flex w-72 border-r border-white/10 bg-white/5 backdrop-blur-xl p-6 flex-col">
        <h1 className="text-2xl font-bold">AI Study Assistant</h1>

        <div className="mt-10 space-y-3 text-sm text-gray-300">
          <p>📘 Study smarter</p>
          <p>🧠 Deep AI reasoning</p>
          <p>🌐 Research assistance</p>
          <p>📄 PDF support coming soon</p>
        </div>
      </aside>

      <section className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, index) => (
            <ChatBubble
              key={index}
              role={msg.role}
              content={msg.content}
            />
          ))}

          {loading && <TypingLoader />}
        </div>

        <div className="p-5 border-t border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="flex gap-3 mb-4 max-w-4xl mx-auto">
  <button
    onClick={() => setMode("quick")}
    className={`px-4 py-2 rounded-xl transition-all ${
      mode === "quick"
        ? "bg-blue-600"
        : "bg-white/10"
    }`}
  >
    ⚡ Quick
  </button>

  <button
    onClick={() => setMode("deep")}
    className={`px-4 py-2 rounded-xl transition-all ${
      mode === "deep"
        ? "bg-purple-600"
        : "bg-white/10"
    }`}
  >
    🧠 Deep
  </button>

  <button
    onClick={() => setMode("research")}
    className={`px-4 py-2 rounded-xl transition-all ${
      mode === "research"
        ? "bg-green-600"
        : "bg-white/10"
    }`}
  >
    🌐 Research
  </button>
  <label className="cursor-pointer rounded-2xl bg-white/10 hover:bg-white/20 px-4 flex items-center justify-center">
  <ImagePlus />

  <input
    type="file"
    accept="image/*"
    hidden
    onChange={(e) => {
      if (e.target.files?.[0]) {
        setImage(e.target.files[0]);
      }
    }}
  />
</label>
</div>
          <div className="flex gap-3 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 rounded-2xl bg-white/10 border border-white/10 px-5 py-4 outline-none focus:border-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                }
              }}
            />

            <button
              onClick={sendMessage}
              className="rounded-2xl bg-blue-600 hover:bg-blue-700 px-5 transition-all"
            >
              <Send />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}