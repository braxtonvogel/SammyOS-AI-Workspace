// app/chat-float/page.tsx
// Floating Sam chat window — frameless Tauri WebviewWindow.
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatHistory } from "@/lib/use-chat-history";
import ChatHistoryPanel from "@/components/chat/ChatHistoryPanel";
import { useAuthStore } from "@/lib/auth-store";

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
        if (match.index > last) parts.push(str.slice(last, match.index));
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
      result.push(<div key={`line-${lineIdx}`}>{inlineNodes}</div>);
    }
  });

  return <>{result}</>;
}

export default function ChatFloatPage() {
  const {
    mounted,
    sessions,
    activeSession,
    activeId,
    createSession,
    selectSession,
    renameSession,
    deleteSession,
    appendMessage,
    updateLastAssistantMessage,
  } = useChatHistory();

  const { user, hydrate } = useAuthStore(); // ← NEW: destructure hydrate

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [shielded, setShielded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [screenCtx, setScreenCtx] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingMessageRef = useRef<{ text: string; img?: string } | null>(null);

  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    hydrate(); // ← NEW: load token from localStorage on mount
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(window as any).__TAURI_INTERNALS__) return;

    let unlistenFrame: (() => void) | null = null;

    import("@tauri-apps/api/event").then(({ listen, emit }) => {
      listen("screen-frame", (e: any) => {
        setScreenCtx(e.payload?.base64 ?? null);
      }).then((fn) => {
        unlistenFrame = fn;
      });

      emit("float-request-frame");
    });

    return () => {
      unlistenFrame?.();
    };
  }, []);

  const tauriInvoke = useCallback(async (cmd: string, args?: Record<string, unknown>) => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke(cmd, args);
    } catch (e) {
      console.error(`[tauri] ${cmd}:`, e);
    }
  }, []);

  const tauriEmit = useCallback(async (event: string, payload?: unknown) => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    try {
      const { emit } = await import("@tauri-apps/api/event");
      await emit(event, payload);
    } catch {}
  }, []);

  const togglePin = useCallback(async () => {
    const next = !pinned;
    setPinned(next);
    await tauriInvoke("set_float_always_on_top", { onTop: next });
  }, [pinned, tauriInvoke]);

  const toggleShield = useCallback(async () => {
    const next = !shielded;
    setShielded(next);
    await tauriInvoke("set_float_content_protection", { protected: next });
  }, [shielded, tauriInvoke]);

  const handleMinimize = useCallback(async () => {
    await tauriInvoke("minimize_float");
  }, [tauriInvoke]);

  const handleReturn = useCallback(async () => {
    await tauriInvoke("close_float");
  }, [tauriInvoke]);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      await tauriEmit("workspace-stop-recording");
      setRecording(false);
    } else {
      await tauriEmit("workspace-start-recording");
      setRecording(true);
    }
  }, [recording, tauriEmit]);

  const handleSwapScreen = useCallback(async () => {
    await tauriEmit("workspace-change-screen");
  }, [tauriEmit]);

  const handleScreenshot = useCallback(async () => {
    const isTauri = !!(window as any).__TAURI_INTERNALS__;
    if (!isTauri) return;

    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
      await new Promise((r) => setTimeout(r, 250));

      const { invoke } = await import("@tauri-apps/api/core");
      const base64 = await invoke<string>("capture_screen");

      await getCurrentWindow().show();

      if (base64 && base64.length > 100) {
        setPendingImage(base64);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().show();
      } catch {}
    }
  }, []);

  // ── Send message ──
  const sendMessage = useCallback(
    async (text: string, imgBase64?: string) => {
      if (!text.trim() && !imgBase64) return;
      setLoading(true);
      appendMessage({ role: "user", content: text, imageBase64: imgBase64 });
      appendMessage({ role: "assistant", content: "…" });
      try {
        const history = (activeSession?.messages ?? [])
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("http://localhost:3000/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(user?.token ? { "x-sammy-token": user.token } : {}),
          },
          body: JSON.stringify({
            message: text,
            imageBase64: imgBase64 ?? screenCtx ?? null,
            history,
          }),
        });
        const data = await res.json();
        updateLastAssistantMessage(data.reply ?? "Sam couldn't respond.");
      } catch {
        updateLastAssistantMessage("Connection error — is the app server running?");
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [activeSession, user, screenCtx, appendMessage, updateLastAssistantMessage]
  );

  useEffect(() => {
    if (activeSession && pendingMessageRef.current) {
      const { text, img } = pendingMessageRef.current;
      pendingMessageRef.current = null;
      sendMessage(text, img);
    }
  }, [activeSession, sendMessage]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text && !pendingImage) return;
    const imageToSend = pendingImage;
    setInput("");
    setPendingImage(null);
    if (!activeSession) {
      pendingMessageRef.current = { text, img: imageToSend ?? undefined };
      createSession();
      return;
    }
    sendMessage(text, imageToSend ?? undefined);
  };

  const handleDragMouseDown = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      e.button !== 0 ||
      target.tagName === "BUTTON" ||
      target.closest("button") ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA"
    )
      return;
    if (!(window as any).__TAURI_INTERNALS__) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().startDragging();
    } catch {}
  }, []);

  if (!mounted) return null;

  const btn = (active?: boolean, danger?: boolean): React.CSSProperties => ({
    background: active ? (danger ? "#3b0000" : "#1e1e2e") : "none",
    border: `1px solid ${active ? (danger ? "#dc2626" : "#6366f1") : "#2a2a2e"}`,
    borderRadius: 5,
    color: active ? (danger ? "#fca5a5" : "#a5b4fc") : "#777",
    cursor: "pointer",
    padding: "3px 7px",
    fontSize: 12,
    lineHeight: 1,
    flexShrink: 0,
    transition: "all 0.12s",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0d0d0f",
        color: "#e0e0e0",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* TOOLBAR */}
      <div
        data-tauri-drag-region
        onMouseDown={handleDragMouseDown}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "6px 8px",
          background: "#111114",
          borderBottom: "1px solid #1e1e22",
          flexShrink: 0,
          zIndex: 100,
          minHeight: 38,
        }}
      >
        <button style={btn(showHistory)} onClick={() => setShowHistory((v) => !v)} title="Chat history">
          ←
        </button>
        <button style={btn(!!pendingImage)} onClick={handleScreenshot} title="Take screenshot (attach to next message)">
          📷
        </button>
        <button style={btn(recording, recording)} onClick={toggleRecording} title={recording ? "Stop recording" : "Start recording"}>
          {recording ? "⏹" : "⏺"}
        </button>
        {recording && (
          <button style={btn()} onClick={handleSwapScreen} title="Change recorded screen">
            🔄
          </button>
        )}

        <div
          data-tauri-drag-region
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            cursor: "grab",
            minWidth: 0,
          }}
        >
          {pinned && (
            <span style={{ fontSize: 10, color: "#22d3ee", background: "#0e2a30", border: "1px solid #22d3ee", borderRadius: 4, padding: "1px 5px" }}>
              pinned
            </span>
          )}
          {shielded && (
            <span style={{ fontSize: 10, color: "#4ade80", background: "#0a2a15", border: "1px solid #4ade80", borderRadius: 4, padding: "1px 5px" }}>
              hidden
            </span>
          )}
          {recording && (
            <span style={{ fontSize: 10, color: "#f87171", background: "#2a0a0a", border: "1px solid #f87171", borderRadius: 4, padding: "1px 5px" }}>
              rec ●
            </span>
          )}
          {screenCtx && !pinned && !shielded && !recording && (
            <span style={{ fontSize: 10, color: "#555" }}>✓ screen</span>
          )}
        </div>

        <button style={btn(pinned)} onClick={togglePin} title={pinned ? "Unpin" : "Pin (always on top)"}>
          📌
        </button>
        <button style={btn(shielded)} onClick={toggleShield} title={shielded ? "Show to screen recorders" : "Hide from screen recorders"}>
          🛡
        </button>
        <button style={btn()} onClick={handleMinimize} title="Minimize">
          _
        </button>
        <button style={btn()} onClick={handleReturn} title="Return chat to main window">
          ✕
        </button>
      </div>

      {showHistory && (
        <ChatHistoryPanel
          sessions={sessions}
          activeId={activeId}
          onSelect={(id) => {
            selectSession(id);
            setShowHistory(false);
          }}
          onNew={() => {
            createSession();
            setShowHistory(false);
          }}
          onRename={renameSession}
          onDelete={deleteSession}
          onClose={() => setShowHistory(false)}
          compact={true}
        />
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 10px 0",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <style>{`
          @keyframes samDotF {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
            30% { transform: translateY(-5px); opacity: 1; }
          }
          .sam-dot-f {
            width: 7px; height: 7px; border-radius: 50%;
            background: #666; display: inline-block;
            animation: samDotF 1.2s ease-in-out infinite;
          }
          .sam-dot-f:nth-child(2) { animation-delay: 0.2s; }
          .sam-dot-f:nth-child(3) { animation-delay: 0.4s; }
        `}</style>
        {messages.length === 0 && (
          <div style={{ color: "#333", fontSize: 12, textAlign: "center", paddingTop: 30 }}>
            Ask Sam anything
          </div>
        )}
        {messages.map((msg, i) => {
          const isTyping = msg.role === "assistant" && msg.content === "…";
          return (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.imageBase64 && (
                <img
                  src={`data:image/jpeg;base64,${msg.imageBase64}`}
                  alt="screenshot"
                  style={{ maxWidth: 120, borderRadius: 6, marginRight: 6, alignSelf: "flex-end", border: "1px solid #2a2a2e" }}
                />
              )}
              <div
                style={{
                  maxWidth: "82%",
                  padding: isTyping ? "10px 14px" : "8px 11px",
                  borderRadius: msg.role === "user" ? "13px 13px 3px 13px" : "13px 13px 13px 3px",
                  background: msg.role === "user" ? "#2d2d5e" : "#1a1a1f",
                  border: `1px solid ${msg.role === "user" ? "#4a4a8f" : "#2a2a2e"}`,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: msg.role === "user" ? "#c7d2fe" : "#ccc",
                  whiteSpace: msg.role === "user" ? "pre-wrap" : undefined,
                  wordBreak: "break-word",
                  userSelect: "text",
                }}
              >
                {isTyping ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span className="sam-dot-f" />
                    <span className="sam-dot-f" />
                    <span className="sam-dot-f" />
                  </div>
                ) : msg.role === "user" ? (
                  msg.content
                ) : (
                  renderMarkdown(msg.content)
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {pendingImage && (
        <div
          style={{
            padding: "5px 10px",
            background: "#111114",
            borderTop: "1px solid #1e1e22",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <img
            src={`data:image/png;base64,${pendingImage}`}
            alt="screenshot preview"
            style={{ height: 36, borderRadius: 5, border: "1px solid #2a2a2e" }}
          />
          <span style={{ fontSize: 10, color: "#555", flex: 1 }}>
            Screenshot attached — type your question and hit Send
          </span>
          <button
            onClick={() => setPendingImage(null)}
            style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 13 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: "7px 8px 10px",
          borderTop: "1px solid #1e1e22",
          background: "#111114",
          display: "flex",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={pendingImage ? "Type your question about the screenshot…" : "Ask Sam…"}
          rows={1}
          disabled={loading}
          style={{
            flex: 1,
            background: "#1a1a1f",
            border: `1px solid ${pendingImage ? "#4a4a8f" : "#2a2a2e"}`,
            borderRadius: 8,
            color: "#e0e0e0",
            fontSize: 12,
            padding: "7px 10px",
            resize: "none",
            outline: "none",
            fontFamily: "inherit",
            lineHeight: 1.5,
            maxHeight: 100,
            overflowY: "auto",
            opacity: loading ? 0.5 : 1,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || (!input.trim() && !pendingImage)}
          style={{
            background: loading ? "#1e1e22" : "#4f46e5",
            border: "none",
            borderRadius: 8,
            color: loading ? "#555" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            padding: "7px 13px",
            fontSize: 14,
            fontWeight: 700,
            alignSelf: "flex-end",
          }}
        >
          {loading ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}