"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNexusStore } from "@/lib/sammy-store";
import { getSamSuggestion } from "@/lib/sam-brain";
import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { useChatHistory } from "@/lib/use-chat-history";
import { useAuthStore } from "@/lib/auth-store";

// ─────────────────────────────────────────────────────────────────────────────
// Markdown renderer — converts a message string to React elements.
// Handles: **bold**, *italic*, `inline code`, and bullet lines (*/-)
// ─────────────────────────────────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    const isBullet = /^(\s*[-*•]\s)/.test(line);
    const lineContent = isBullet ? line.replace(/^\s*[-*•]\s/, "") : line;

    const parseInline = (str: string, keyPrefix: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
      let last = 0;
      let match: RegExpExecArray | null;

      while ((match = re.exec(str)) !== null) {
        if (match.index > last) {
          parts.push(str.slice(last, match.index));
        }
        if (match[1]) {
          parts.push(<strong key={`${keyPrefix}-b-${match.index}`} style={{ fontWeight: 700, color: "inherit" }}>{match[2]}</strong>);
        } else if (match[3]) {
          parts.push(<em key={`${keyPrefix}-i-${match.index}`} style={{ fontStyle: "italic", color: "inherit" }}>{match[4]}</em>);
        } else if (match[5]) {
          parts.push(
            <code key={`${keyPrefix}-c-${match.index}`} style={{
              fontFamily: "monospace",
              background: "rgba(255,255,255,0.08)",
              borderRadius: 3,
              padding: "1px 4px",
              fontSize: "0.9em",
            }}>{match[6]}</code>
          );
        }
        last = match.index + match[0].length;
      }

      if (last < str.length) parts.push(str.slice(last));
      return parts;
    };

    const inlineNodes = parseInline(lineContent, `line-${lineIdx}`);

    if (isBullet) {
      result.push(
        <div key={`line-${lineIdx}`} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
          <span style={{ opacity: 0.5, flexShrink: 0 }}>•</span>
          <span>{inlineNodes}</span>
        </div>
      );
    } else if (lineContent.trim() === "") {
      if (lineIdx < lines.length - 1) {
        result.push(<div key={`line-${lineIdx}`} style={{ height: 6 }} />);
      }
    } else {
      result.push(
        <div key={`line-${lineIdx}`}>{inlineNodes}</div>
      );
    }
  });

  return <>{result}</>;
}

export default function SammyShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // =========================
  // 🧠 GLOBAL STORE
  // =========================
  const {
    messages,
    addMessage,
    isThinking,
    setIsThinking,
    latestFrame,
    intent,
    currentContext,
  } = useNexusStore();

  // =========================
  // AUTH
  // =========================
  const user = useAuthStore((s) => s.user);

  // =========================
  // SHARED CHAT HISTORY
  // =========================
  const { activeSession } = useChatHistory();

  const lastMessage = messages[messages.length - 1];
  const suggestion = getSamSuggestion(intent, lastMessage?.content ?? "");

  // =========================
  // LOCAL UI STATE
  // =========================
  const [input, setInput] = useState("");
  const [isFloating, setIsFloating] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const init = async () => {
      try {
        await emit("chat:request-history");
      } catch {}
    };
    init();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    (async () => {
      unlisten = await listen("chat:history", (event: any) => {
        const history = event.payload;
        seenRef.current.clear();
        history.forEach((msg: any) => {
          const key = `${msg.role}-${msg.timestamp}-${msg.content}`;
          seenRef.current.add(key);
          addMessage(msg);
        });
      });
    })();

    return () => unlisten?.();
  }, [addMessage]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    (async () => {
      unlisten = await listen("chat:message", (event: any) => {
        const msg = event.payload;
        console.log("SHELL RECEIVED", msg);
        const key = msg.id ?? `${msg.role}-${msg.timestamp}-${msg.content}`;
        if (seenRef.current.has(key)) return;
        seenRef.current.add(key);
        addMessage(msg);
      });
    })();

    return () => unlisten?.();
  }, [addMessage]);

  // =========================
  // SEND MESSAGE
  // =========================
  const sendMessage = async (text?: string, imageBase64?: string) => {
    const content = text || input.trim();
    if (!content && !imageBase64) return;

    setInput("");

    const userMsg = {
      role: "user",
      content,
      imageBase64,
      timestamp: new Date(),
    };

    await emit("chat:message", userMsg);
    setIsThinking(true);

    try {
      const imageToSend = imageBase64 || latestFrame || null;

      const history = (activeSession?.messages ?? [])
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.token ? { "x-sammy-token": user.token } : {}),
        },
        body: JSON.stringify({
          message: content,
          imageBase64: imageToSend,
          history,
        }),
      });

      const data = await res.json();

      await emit("chat:message", {
        role: "sam",
        content: data.reply,
        timestamp: new Date(),
      });
    } catch {
      await emit("chat:message", {
        role: "sam",
        content: "Connection error.",
        timestamp: new Date(),
      });
    } finally {
      setIsThinking(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // =========================
  // SCREENSHOT
  // =========================
  const handleScreenshot = async () => {
    try {
      const base64 = await invoke<string>("capture_screen");
      if (base64 && base64.length > 100) {
        setPendingImage(base64);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {
      // capture_screen failed — silently ignore
    }
  };

  const handleSubmit = () => {
    const text = input.trim();
    if (!text && !pendingImage) return;
    const imageToSend = pendingImage;
    setPendingImage(null);
    sendMessage(text, imageToSend ?? undefined);
  };

  // =========================
  // FLOAT WINDOW
  // =========================
  const handleFloat = async () => {
    try {
      await invoke("float_chat");
      setIsFloating(true);
    } catch (e) {
      console.error("Float failed:", e);
    }
  };

  const handleReturnChat = async () => {
    try {
      await invoke("close_float");
      setIsFloating(false);
    } catch (e) {
      console.error("Return failed:", e);
    }
  };

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/chat", label: "Chat" },
    { href: "/vault", label: "Vault" },
    { href: "/workspace", label: "Workspace" },
    { href: "/research", label: "Research" },
    { label: "Education", href: "/education" },
    { href: "/qa-lab", label: "QA Lab" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <div className="flex flex-col h-screen w-full bg-black text-white">
      {/* ===== TOP NAVBAR ===== */}
      <header className="flex items-center gap-6 px-6 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs font-bold">
            N
          </div>
          <span className="text-sm font-semibold">Sammy OS</span>
        </div>

        <nav className="flex items-center gap-1 text-sm">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-1.5 rounded-lg transition ${
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* ===== BODY ===== */}
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 overflow-auto relative">{children}</main>

        {/* ===== RIGHT SIDEBAR ===== */}
        <aside className="w-80 border-l border-zinc-800 flex flex-col hidden lg:flex">
          <div className="p-4 border-b border-zinc-800 shrink-0">
            <div className="text-xs font-semibold text-zinc-300 mb-3">
              Sam (AI)
            </div>

            <div className="space-y-2 text-xs text-zinc-400">
              <div className="p-2.5 border border-zinc-800 rounded-lg">
                🧭 Page: {pathname}
              </div>
              <div className="p-2.5 border border-zinc-800 rounded-lg">
                🧠 Mode: {intent}
              </div>
              <div className="p-2.5 border border-zinc-800 rounded-lg">
                📦 Context: {currentContext}
              </div>
              <div className="p-2.5 border border-zinc-800 rounded-lg bg-zinc-900">
                ⚡ {suggestion}
              </div>
            </div>
          </div>

          {/* ===== CHATBOX ===== */}
          <div className="flex-1 flex flex-col min-h-0">
            {isFloating ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
                <div className="w-12 h-12 rounded-full border-2 border-zinc-700 flex items-center justify-center text-zinc-500 text-xl">
                  💬
                </div>
                <p className="text-xs text-zinc-500 text-center">
                  Sam chat is floating
                </p>
                <button
                  onClick={handleReturnChat}
                  className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
                >
                  ↩ Return Chat Here
                </button>
              </div>
            ) : (
              <>
                {/* toolbar */}
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-800 shrink-0">
                  <button
                    onClick={handleScreenshot}
                    className={`p-1.5 rounded-lg transition text-xs ${
                      pendingImage
                        ? "text-indigo-400 bg-zinc-800"
                        : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                    }`}
                    title="Take screenshot (attach to next message)"
                  >
                    📷
                  </button>

                  <button
                    onClick={handleFloat}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition text-xs"
                  >
                    ⬡
                  </button>

                  <div className="flex-1" />
                  <span className="text-xs text-zinc-600">Sam Chat</span>
                </div>

                {/* messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  <style>{`
                    @keyframes samDot {
                      0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
                      30% { transform: translateY(-4px); opacity: 1; }
                    }
                    .sam-dot { width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block; animation: samDot 1.2s ease-in-out infinite; }
                    .sam-dot:nth-child(2) { animation-delay: 0.2s; }
                    .sam-dot:nth-child(3) { animation-delay: 0.4s; }
                  `}</style>

                  {messages.length === 0 && (
                    <div className="text-center text-zinc-500 text-xs mt-6">
                      <p>Ask Sam anything.</p>
                      <p className="mt-1">Sam sees your screen and vault files.</p>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${
                          msg.role === "user"
                            ? "bg-white text-black"
                            : "bg-zinc-800 text-zinc-100 border border-zinc-700"
                        }`}
                      >
                        {msg.imageBase64 && (
                          <img
                            src={`data:image/jpeg;base64,${msg.imageBase64}`}
                            className="rounded mb-1"
                            alt="screenshot"
                          />
                        )}
                        {msg.role === "user"
                          ? msg.content
                          : renderMarkdown(msg.content)}
                      </div>
                    </div>
                  ))}

                  {isThinking && (
                    <div className="flex justify-start">
                      <div className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 flex gap-1 items-center" style={{ minHeight: 32 }}>
                        <span className="sam-dot" />
                        <span className="sam-dot" />
                        <span className="sam-dot" />
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>

                {/* screenshot preview bar */}
                {pendingImage && (
                  <div className="flex items-center gap-2 px-3 py-1.5 border-t border-zinc-800 bg-zinc-900/60">
                    <img
                      src={`data:image/png;base64,${pendingImage}`}
                      alt="screenshot preview"
                      className="h-8 rounded border border-zinc-700 object-cover"
                    />
                    <span className="text-xs text-zinc-500 flex-1">
                      Screenshot attached — type your question
                    </span>
                    <button
                      onClick={() => setPendingImage(null)}
                      className="text-zinc-600 hover:text-zinc-300 text-xs transition"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* input */}
                <div className="p-3 border-t border-zinc-800">
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      placeholder={pendingImage ? "Type your question…" : "Ask Sam..."}
                      className={`flex-1 bg-zinc-900 border rounded-xl px-3 py-2 text-xs text-white ${
                        pendingImage ? "border-indigo-700" : "border-zinc-700"
                      }`}
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={(!input.trim() && !pendingImage) || isThinking}
                      className="px-3 py-2 bg-white text-black rounded-xl text-xs disabled:opacity-30"
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}