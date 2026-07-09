// Shared helpers and style tokens for QA Lab components

import { useAuthStore } from "@/lib/auth-store";

export const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid #1e1e1e",
  borderRadius: "12px",
  padding: "20px",
};

export const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "#888",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: "8px",
  fontFamily: "var(--font-geist-mono, monospace)",
};

export const TEXTAREA_STYLE: React.CSSProperties = {
  width: "100%",
  background: "#111",
  border: "1px solid #222",
  borderRadius: "8px",
  padding: "12px 14px",
  color: "#e0e0e0",
  fontSize: "13px",
  fontFamily: "var(--font-geist-mono, monospace)",
  lineHeight: 1.6,
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
};

export const BUTTON_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "11px 22px",
  borderRadius: "8px",
  background: "rgba(0,245,255,0.1)",
  border: "1px solid rgba(0,245,255,0.3)",
  color: "#00f5ff",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s ease",
};

export const BUTTON_DISABLED_STYLE: React.CSSProperties = {
  ...BUTTON_STYLE,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid #222",
  color: "#444",
  cursor: "not-allowed",
};

export const SELECT_STYLE: React.CSSProperties = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: "8px",
  padding: "10px 14px",
  color: "#e0e0e0",
  fontSize: "13px",
  fontFamily: "var(--font-geist-mono, monospace)",
  outline: "none",
  cursor: "pointer",
};

export const SECTION_HEADER: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#00f5ff",
  fontFamily: "var(--font-geist-mono, monospace)",
  marginBottom: "10px",
};

export const CODE_BLOCK: React.CSSProperties = {
  background: "#0d0d0d",
  border: "1px solid #1e1e1e",
  borderRadius: "8px",
  padding: "14px 16px",
  fontFamily: "var(--font-geist-mono, monospace)",
  fontSize: "12px",
  color: "#cdd6f4",
  lineHeight: 1.65,
  overflowX: "auto",
  whiteSpace: "pre",
};

export const PRIORITY_COLORS: Record<string, string> = {
  P0: "#ff5555",
  P1: "#ffb86c",
  P2: "#8be9fd",
  P3: "#50fa7b",
};

export const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#ff5555",
  High: "#ffb86c",
  Medium: "#f1fa8c",
  Low: "#50fa7b",
};

/**
 * Call the SammyOS /api/chat endpoint and return the text reply.
 * Pass { json: true } to route through the JSON-only system prompt
 * (bypasses Sam's persona, vault injection, and web search).
 *
 * Reads the auth token from the Zustand auth store directly (via
 * getState(), not the useAuthStore hook, since this is a plain
 * utility function, not a component) and attaches it as
 * x-sammy-token — same as the main chat page does. Without this,
 * /api/chat can't inject the user's provider API keys and every
 * provider fails, producing a 502.
 */
export async function callSam(
  prompt: string,
  opts?: { json?: boolean }
): Promise<string> {
  const token = useAuthStore.getState().user?.token;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-sammy-token": token } : {}),
    },
    body: JSON.stringify({
      message: prompt,
      mode: opts?.json ? "json" : undefined,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    // Route returned a non-2xx status — e.g. the 502 "All providers
    // unavailable" from JSON mode. Surface the server's actual error
    // message instead of just the status code.
    throw new Error(data?.error ?? `Chat API error: ${res.status}`);
  }
  if (opts?.json && data?.error) {
    // Request succeeded (200) but the model itself emitted {"error": "..."}
    // per the JSON_SYSTEM_PROMPT contract.
    throw new Error(`Sam declined: ${data.error}`);
  }
  if (opts?.json && typeof data.reply !== "string") {
    // Defensive: JSON mode expects a reply string to hand to parseJSON.
    throw new Error("Sam returned no usable reply in JSON mode.");
  }

  return data.reply as string;
}

/**
 * Strip markdown code fences and parse JSON safely.
 * Falls back to extracting the first {...} or [...] block if the
 * model added stray prose before/after the JSON.
 */
export function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // fall through to error below
      }
    }
    throw new Error(
      `Sam didn't return valid JSON. Raw response: ${raw.slice(0, 200)}`
    );
  }
}