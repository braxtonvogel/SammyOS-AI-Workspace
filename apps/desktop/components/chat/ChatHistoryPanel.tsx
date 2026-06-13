// components/chat/ChatHistoryPanel.tsx
// Reusable slide-in history panel used by:
//   - Float window (chat-float/page.tsx)
//   - Chat tab (app/chat/page.tsx)
//   - Sam sidebar (sammy-shell.tsx)
// All panels share the same localStorage data via useChatHistory hook.
"use client";

import { useState } from "react";
import type { ChatSession } from "@/lib/use-chat-history";

interface Props {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  /** compact = true in the float window & sidebar; false in full Chat tab */
  compact?: boolean;
}

export default function ChatHistoryPanel({
  sessions,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onClose,
  compact = false,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const startEdit = (s: ChatSession) => {
    setEditingId(s.id);
    setEditValue(s.name);
  };

  const commitEdit = (id: string) => {
    if (editValue.trim()) onRename(id, editValue.trim());
    setEditingId(null);
  };

  const containerStyle: React.CSSProperties = compact
    ? {
        width: "100%",
        background: "#111114",
        borderBottom: "1px solid #2a2a2e",
        maxHeight: 260,
        overflowY: "auto",
        flexShrink: 0,
      }
    : {
        width: 240,
        background: "#111114",
        borderRight: "1px solid #2a2a2e",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flexShrink: 0,
      };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px 8px",
          borderBottom: "1px solid #1e1e22",
          gap: 8,
          position: "sticky",
          top: 0,
          background: "#111114",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Chats
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {/* New chat */}
          <button
            onClick={onNew}
            title="New chat"
            style={{
              background: "#1e1e22",
              border: "none",
              borderRadius: 5,
              color: "#ccc",
              cursor: "pointer",
              padding: "3px 8px",
              fontSize: 13,
              lineHeight: 1,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "#2a2a2e")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "#1e1e22")
            }
          >
            + New
          </button>
          {/* Close panel */}
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: "none",
              border: "none",
              color: "#555",
              cursor: "pointer",
              fontSize: 14,
              padding: "2px 4px",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#aaa")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Session list */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {sessions.length === 0 && (
          <div
            style={{
              padding: "20px 12px",
              color: "#444",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            No chats yet
          </div>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 10px",
              cursor: "pointer",
              background:
                s.id === activeId
                  ? "#1a1a1f"
                  : hoveredId === s.id
                  ? "#161619"
                  : "transparent",
              borderLeft:
                s.id === activeId
                  ? "2px solid #6366f1"
                  : "2px solid transparent",
              transition: "background 0.1s",
            }}
            onClick={() => {
              if (editingId !== s.id) {
                onSelect(s.id);
              }
            }}
          >
            {/* Name or rename input */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingId === s.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit(s.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "#0d0d0f",
                    border: "1px solid #6366f1",
                    borderRadius: 4,
                    color: "#fff",
                    fontSize: 12,
                    padding: "2px 6px",
                    width: "100%",
                    outline: "none",
                  }}
                />
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      color: s.id === activeId ? "#e0e0ff" : "#aaa",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontWeight: s.id === activeId ? 500 : 400,
                    }}
                  >
                    {s.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>
                    {s.messages.length} msg
                    {s.messages.length !== 1 ? "s" : ""}
                  </div>
                </>
              )}
            </div>

            {/* Action buttons — show on hover or when active */}
            {(hoveredId === s.id || s.id === activeId) &&
              editingId !== s.id && (
                <div
                  style={{ display: "flex", gap: 3, flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => startEdit(s)}
                    title="Rename"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#555",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: "2px 4px",
                      borderRadius: 3,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "#aaa")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "#555")
                    }
                  >
                    ✏
                  </button>
                  <button
                    onClick={() => onDelete(s.id)}
                    title="Delete"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#555",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: "2px 4px",
                      borderRadius: 3,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "#e55")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "#555")
                    }
                  >
                    🗑
                  </button>
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}