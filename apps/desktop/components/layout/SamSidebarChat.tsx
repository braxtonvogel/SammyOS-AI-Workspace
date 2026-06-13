// components/layout/SamSidebarChat.tsx
// The right-sidebar Sam chatbox used inside SammyShell.
// Shares the same localStorage chat history as the float window and Chat tab.
// Drop this component into sammy-shell.tsx to replace the inline chat state.
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatHistory } from "@/lib/use-chat-history";
import ChatHistoryPanel from "@/components/chat/ChatHistoryPanel";

interface Props {
  latestFrame?: string | null;
}

export default function SamSidebarChat({ latestFrame }: Props) {
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

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string, imgBase64?: string) => {
      if (!text.trim() && !imgBase64) return;
      setLoading(true);
      appendMessage({ role: "user", content: text, imageBase64: imgBase64 });
      appendMessage({ role: "assistant", content: "…" });
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            imageBase64: imgBase64 ?? latestFrame ?? null,
            history: activeSession?.messages.slice(-20) ?? [],
          }),
        });
        const data = await res.json();
        updateLastAssistantMessage(data.reply ?? "Sam couldn't respond.");
      } catch {
        updateLastAssistantMessage("Connection error.");
      } finally {
        setLoading(false);
      }
    },
    [activeSession, latestFrame, appendMessage, updateLastAssistantMessage]
  );

  const handleSubmit = () => {
    const text = input.trim();
    if (!text && !screenshotBase64) return;
    sendMessage(text, screenshotBase64 ?? undefined);
    setInput("");
    setScreenshotBase64(null);
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
    } catch {}
  };

  if (!mounted) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* ── History panel (slides in above chat) ── */}
      {showHistory && (
        <ChatHistoryPanel
          sessions={sessions}
          activeId={activeId}
          onSelect={(id) => { selectSession(id); setShowHistory(false); }}
          onNew={() => { createSession(); setShowHistory(false); }}
          onRename={renameSession}
          onDelete={deleteSession}
          onClose={() => setShowHistory(false)}
          compact={true}
        />
      )}

      {/* ── Toolbar row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderBottom: "1px solid #1e1e22",
          background: "#111114",
          flexShrink: 0,
        }}
      >
        {/* History toggle */}
        <button
          onClick={() => setShowHistory((v) => !v)}
          title="Chat history"
          style={{
            background: showHistory ? "#1e1e2e" : "none",
            border: `1px solid ${showHistory ? "#6366f1" : "#2a2a2e"}`,
            borderRadius: 5,
            color: showHistory ? "#a5b4fc" : "#666",
            cursor: "pointer",
            padding: "3px 8px",
            fontSize: 12,
            transition: "all 0.12s",
          }}
        >
          ← Chats
        </button>

        {/* Current chat name */}
        <span
          style={{
            fontSize: 11,
            color: "#555",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {activeSession?.name ?? ""}
        </span>

        {/* Screenshot */}
        <button
          onClick={handleScreenshot}
          title="Attach screenshot"
          style={{
            background: screenshotBase64 ? "#14532d" : "none",
            border: `1px solid ${screenshotBase64 ? "#22c55e" : "#2a2a2e"}`,
            borderRadius: 5,
            color: screenshotBase64 ? "#86efac" : "#666",
            cursor: "pointer",
            padding: "3px 6px",
            fontSize: 12,
          }}
        >
          📷
        </button>
      </div>

      {/* ── Messages ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "#333", fontSize: 11, textAlign: "center", paddingTop: 20 }}>
            Ask Sam anything
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "7px 10px",
                borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                background: msg.role === "user" ? "#2d2d5e" : "#1a1a1f",
                border: `1px solid ${msg.role === "user" ? "#4a4a8f" : "#2a2a2e"}`,
                fontSize: 12,
                lineHeight: 1.5,
                color: msg.role === "user" ? "#c7d2fe" : "#ccc",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Screenshot preview ── */}
      {screenshotBase64 && (
        <div
          style={{
            padding: "4px 8px",
            background: "#111114",
            borderTop: "1px solid #1e1e22",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <img
            src={`data:image/jpeg;base64,${screenshotBase64}`}
            alt="preview"
            style={{ height: 32, borderRadius: 4, border: "1px solid #2a2a2e" }}
          />
          <button
            onClick={() => setScreenshotBase64(null)}
            style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 13, marginLeft: "auto" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Input ── */}
      <div
        style={{
          padding: "6px 8px 8px",
          borderTop: "1px solid #1e1e22",
          background: "#111114",
          display: "flex",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <textarea
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
            borderRadius: 8,
            color: "#e0e0e0",
            fontSize: 12,
            padding: "7px 10px",
            resize: "none",
            outline: "none",
            fontFamily: "inherit",
            lineHeight: 1.5,
            maxHeight: 80,
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
            borderRadius: 8,
            color: loading ? "#555" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            padding: "7px 12px",
            fontSize: 13,
            fontWeight: 600,
            alignSelf: "flex-end",
          }}
        >
          {loading ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}