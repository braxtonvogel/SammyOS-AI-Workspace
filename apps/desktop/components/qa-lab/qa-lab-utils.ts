// Shared helpers and style tokens for QA Lab components

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

/** Call the SammyOS /api/chat endpoint and return the text reply */
export async function callSam(prompt: string): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt }),
  });
  if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
  const data = await res.json();
  return data.reply as string;
}

/** Strip markdown code fences and parse JSON safely */
export function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  return JSON.parse(cleaned) as T;
}