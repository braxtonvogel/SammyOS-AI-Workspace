// lib/use-chat-history.ts
// Shared hook for chat history — used by float window, Chat tab, and Sam sidebar.
// All three read/write the same localStorage key so chats are always in sync.

import { useState, useEffect, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  imageBase64?: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "sammy-chats";
const MAX_SESSIONS = 50;

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    // Deduplicate before saving — safety net against any double-add
    const seen = new Set<string>();
    const unique = sessions.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    // Keep only the most recent MAX_SESSIONS
    const trimmed = unique.slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    // NOTE: Do NOT dispatch a synthetic StorageEvent here.
    // The native `storage` event only fires in OTHER windows/tabs (not the one
    // that called setItem). Dispatching it manually causes the same-window
    // storage listener to fire immediately after every write, racing with the
    // in-flight React state update and producing duplicate session entries.
    // Cross-window sync works automatically via the native event.
  } catch {}
}

/** Deduplicate sessions by ID after loading from disk */
function dedup(sessions: ChatSession[]): ChatSession[] {
  const seen = new Set<string>();
  return sessions.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load on mount — also rewrites localStorage if duplicates were found,
  // which cleans up any corrupted state from before this fix was applied.
  useEffect(() => {
    const raw = loadSessions();
    const stored = dedup(raw);
    // If dedup removed anything, write the clean version back immediately
    if (stored.length !== raw.length) {
      saveSessions(stored);
    }
    if (stored.length === 0) {
      const first = newSession();
      setSessions([first]);
      setActiveId(first.id);
      saveSessions([first]);
    } else {
      setSessions(stored);
      setActiveId(stored[0].id);
    }
    setMounted(true);
  }, []);

  // Listen for cross-window storage events (float ↔ main sync).
  // This fires ONLY when another window/tab writes to localStorage —
  // never for writes made by this window (native browser behaviour).
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const updated = dedup(loadSessions());
        setSessions(updated);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0] ?? null;

  const createSession = useCallback(() => {
    const s = newSession();
    setSessions((prev) => {
      const updated = [s, ...prev];
      saveSessions(updated);
      return updated;
    });
    setActiveId(s.id);
    return s;
  }, []);

  const selectSession = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const renameSession = useCallback((id: string, name: string) => {
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, name: name.trim() || "Chat" } : s
      );
      saveSessions(updated);
      return updated;
    });
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        saveSessions(updated);
        // If we deleted the active session, switch to the next one
        if (id === activeId) {
          const next = updated[0];
          setActiveId(next?.id ?? null);
        }
        return updated;
      });
    },
    [activeId]
  );

  const appendMessage = useCallback(
    (msg: Omit<ChatMessage, "timestamp">) => {
      if (!activeId) return;
      setSessions((prev) => {
        const mapped = prev.map((s) => {
          if (s.id !== activeId) return s;
          const newMsg: ChatMessage = { ...msg, timestamp: Date.now() };
          return {
            ...s,
            messages: [...s.messages, newMsg],
            updatedAt: Date.now(),
          };
        });
        // Sort most-recently-updated first (produce a new array to avoid mutation)
        const sorted = [...mapped].sort((a, b) => b.updatedAt - a.updatedAt);
        // Dedup as a final safety net
        const updated = dedup(sorted);
        saveSessions(updated);
        return updated;
      });
    },
    [activeId]
  );

  const updateLastAssistantMessage = useCallback(
    (content: string) => {
      if (!activeId) return;
      setSessions((prev) => {
        const updated = prev.map((s) => {
          if (s.id !== activeId) return s;
          const msgs = [...s.messages];
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "assistant") {
              msgs[i] = { ...msgs[i], content };
              break;
            }
          }
          return { ...s, messages: msgs, updatedAt: Date.now() };
        });
        saveSessions(updated);
        return updated;
      });
    },
    [activeId]
  );

  return {
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
  };
}

function newSession(): ChatSession {
  return {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `Chat ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}