"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "sam" | "transcript";
  content: string;
  timestamp: Date;
}

interface SamSidebarProps {
  messages: Message[];
  onAsk: (question: string) => void;
  isAnalyzing: boolean;
}

export function SamSidebar({ messages, onAsk, isAnalyzing }: SamSidebarProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onAsk(input.trim());
    setInput("");
  };

  return (
    <div className="w-80 h-full flex flex-col bg-zinc-950 border-l border-zinc-800">

      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs font-bold">
          S
        </div>
        <div>
          <p className="text-sm font-medium">Sam</p>
          <p className="text-xs text-zinc-500">
            {isAnalyzing ? "Analyzing screen..." : "Ready"}
          </p>
        </div>
        {isAnalyzing && (
          <div className="ml-auto flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-zinc-600 text-xs mt-8 space-y-2">
            <p>Connect a screen to get started.</p>
            <p>Sam will proactively assist you.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col gap-1 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {msg.role === "transcript" ? (
              // Transcript bubble
              <div className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-xs text-zinc-500 mb-1">🎤 Heard</p>
                <p className="text-xs text-zinc-400 italic">{msg.content}</p>
              </div>
            ) : (
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-white text-black"
                    : "bg-zinc-800 text-zinc-100 border border-zinc-700"
                }`}
              >
                {msg.content}
              </div>
            )}

            <span className="text-xs text-zinc-600">
              {msg.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask Sam anything..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2
                       text-sm text-white placeholder:text-zinc-600
                       focus:outline-none focus:border-zinc-500 transition"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-3 py-2 bg-white text-black rounded-xl text-sm
                       hover:bg-zinc-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

