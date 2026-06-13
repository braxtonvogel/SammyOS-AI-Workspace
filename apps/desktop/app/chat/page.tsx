// app/chat/page.tsx
// Full-width Chat tab — same shared chat history as float window and Sam sidebar.
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatHistory } from "@/lib/use-chat-history";
import ChatHistoryPanel from "@/components/chat/ChatHistoryPanel";
import { useAuthStore } from "@/lib/auth-store";

import { useTelemetry } from "@/lib/use-telemetry"; 

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

export default function ChatPage() {
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

  const user = useAuthStore((s) => s.user);
const { ping } = useTelemetry();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingMessageRef = useRef<{ text: string; img?: string } | null>(null);

  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(user?.token ? { "x-sammy-token": user.token } : {}),
          },
          body: JSON.stringify({
            message: text,
            imageBase64: imgBase64 ?? null,
            history,
          }),
        });
        const data = await res.json();
        updateLastAssistantMessage(data.reply ?? "Sam couldn't respond.");
        ping("message_sent", "chat");
      } catch {
        updateLastAssistantMessage("Connection error — check that the app server is running.");
      } finally {
        setLoading(false);
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    },
    [activeSession, user, appendMessage, updateLastAssistantMessage]
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
    if (!text && !screenshotBase64) return;
    const imgToSend = screenshotBase64;
    setInput("");
    setScreenshotBase64(null);
    if (!activeSession) {
      pendingMessageRef.current = { text, img: imgToSend ?? undefined };
      createSession();
      return;
    }
    sendMessage(text, imgToSend ?? undefined);
  };

  const handleScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: false,
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise((r) => setTimeout(r, 150));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((t) => t.stop());
      const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
      if (base64 && base64.length > 100) setScreenshotBase64(base64);
    } catch {
      // user cancelled
    }
  };

  if (!mounted) return null;

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        background: "#0d0d0f",
        color: "#e0e0e0",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── History sidebar ── */}
      {showHistory && (
        <ChatHistoryPanel
          sessions={sessions}
          activeId={activeId}
          onSelect={(id) => {
            selectSession(id);
          }}
          onNew={() => {
            createSession();
          }}
          onRename={renameSession}
          onDelete={deleteSession}
          onClose={() => setShowHistory(false)}
          compact={false}
        />
      )}

      {/* ── Main chat area ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            borderBottom: "1px solid #1e1e22",
            background: "#111114",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setShowHistory((v) => !v)}
            title="Chat history"
            style={{
              background: showHistory ? "#1e1e2e" : "#1a1a1f",
              border: `1px solid ${showHistory ? "#6366f1" : "#2a2a2e"}`,
              borderRadius: 6,
              color: showHistory ? "#a5b4fc" : "#888",
              cursor: "pointer",
              padding: "5px 10px",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!showHistory) e.currentTarget.style.borderColor = "#6366f1";
            }}
            onMouseLeave={(e) => {
              if (!showHistory) e.currentTarget.style.borderColor = "#2a2a2e";
            }}
          >
            ← Chats
          </button>

          <span
            style={{
              fontSize: 13,
              color: "#888",
              flex: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {activeSession?.name ?? "No chat selected"}
          </span>

          <button
            onClick={handleScreenshot}
            title="Attach screenshot"
            style={{
              background: screenshotBase64 ? "#14532d" : "#1a1a1f",
              border: `1px solid ${screenshotBase64 ? "#22c55e" : "#2a2a2e"}`,
              borderRadius: 6,
              color: screenshotBase64 ? "#86efac" : "#888",
              cursor: "pointer",
              padding: "5px 10px",
              fontSize: 13,
            }}
          >
            📷{screenshotBase64 ? " ✓" : ""}
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <style>{`
            @keyframes samDotC {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
              30% { transform: translateY(-5px); opacity: 1; }
            }
            .sam-dot-c {
              width: 7px; height: 7px; border-radius: 50%;
              background: #666; display: inline-block;
              animation: samDotC 1.2s ease-in-out infinite;
            }
            .sam-dot-c:nth-child(2) { animation-delay: 0.2s; }
            .sam-dot-c:nth-child(3) { animation-delay: 0.4s; }
          `}</style>
          {messages.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#333",
                fontSize: 13,
                userSelect: "none",
                paddingTop: 60,
              }}
            >
              Ask Sam anything
            </div>
          )}
          {messages.map((msg, i) => {
            const isTyping = msg.role === "assistant" && msg.content === "…";
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {msg.imageBase64 && (
                  <img
                    src={`data:image/jpeg;base64,${msg.imageBase64}`}
                    alt="Screenshot"
                    style={{
                      maxWidth: 200,
                      borderRadius: 8,
                      marginRight: 8,
                      alignSelf: "flex-end",
                    }}
                  />
                )}
                <div
                  style={{
                    maxWidth: "72%",
                    padding: isTyping ? "12px 16px" : "10px 14px",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: msg.role === "user" ? "#2d2d5e" : "#1a1a1f",
                    border: `1px solid ${msg.role === "user" ? "#4a4a8f" : "#2a2a2e"}`,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: msg.role === "user" ? "#c7d2fe" : "#d0d0e8",
                    whiteSpace: msg.role === "user" ? "pre-wrap" : undefined,
                    wordBreak: "break-word",
                  }}
                >
                  {isTyping ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span className="sam-dot-c" />
                      <span className="sam-dot-c" />
                      <span className="sam-dot-c" />
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

        {/* Screenshot preview strip */}
        {screenshotBase64 && (
          <div
            style={{
              padding: "6px 16px",
              background: "#111114",
              borderTop: "1px solid #1e1e22",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <img
              src={`data:image/jpeg;base64,${screenshotBase64}`}
              alt="preview"
              style={{ height: 44, borderRadius: 6, border: "1px solid #2a2a2e" }}
            />
            <span style={{ fontSize: 11, color: "#666" }}>
              Screenshot will be sent with your message
            </span>
            <button
              onClick={() => setScreenshotBase64(null)}
              style={{
                background: "none",
                border: "none",
                color: "#555",
                cursor: "pointer",
                fontSize: 14,
                marginLeft: "auto",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Input row */}
        <div
          style={{
            padding: "10px 16px 14px",
            borderTop: "1px solid #1e1e22",
            background: "#111114",
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask Sam…"
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              background: "#1a1a1f",
              border: "1px solid #2a2a2e",
              borderRadius: 10,
              color: "#e0e0e0",
              fontSize: 13,
              padding: "9px 12px",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: 1.5,
              maxHeight: 120,
              overflowY: "auto",
              opacity: loading ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || (!input.trim() && !screenshotBase64)}
            style={{
              background: loading ? "#1e1e22" : "#4f46e5",
              border: "none",
              borderRadius: 10,
              color: loading ? "#555" : "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              padding: "9px 16px",
              fontSize: 14,
              fontWeight: 600,
              transition: "background 0.15s",
              alignSelf: "flex-end",
            }}
          >
            {loading ? "…" : "↑"}
          </button>
        </div>
      </div>
    </div>
  );
}