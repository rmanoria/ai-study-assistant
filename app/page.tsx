"use client";

import { useState } from "react";
import Navbar from "./components/Navbar";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Page() {
 const [messages, setMessages] = useState<Message[]>([
  {
    role: "assistant" as const,
    content: "Hello 👋 I’m your AI Study Assistant.",
  },
]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

  const userMessage: Message = {
  role: "user",
  content: input,
};

const newMessages: Message[] = [...messages, userMessage];

setMessages(newMessages);
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();

setMessages((prev) => [
  ...prev,
  {
    role: "assistant",
    content: data.reply,
  },
]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong 😢" },
      ]);
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-col justify-end p-6">
        
        {/* Messages */}
        <div className="w-full max-w-2xl mx-auto space-y-3 mb-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl max-w-[80%] ${
                msg.role === "user"
                  ? "bg-blue-600 ml-auto"
                  : "bg-gray-800"
              }`}
            >
              {msg.content}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="bg-gray-800 p-3 rounded-xl w-fit">
              AI is thinking...
            </div>
          )}
        </div>

        {/* Input */}
        <div className="w-full max-w-2xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={loading}
            className="flex-1 p-3 rounded-xl bg-gray-900 border border-gray-700 disabled:opacity-50"
            placeholder="Ask something..."
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-white text-black px-4 py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>

      </div>
    </main>
  );
}