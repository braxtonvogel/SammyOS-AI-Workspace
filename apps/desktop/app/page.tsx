"use client";

import { listen } from "@tauri-apps/api/event";
import { useEffect, useState, useRef, useCallback } from "react";

import { useTelemetry } from "@/lib/use-telemetry";

import {
  interpretBehavior,
  getSamInsight,
  type BehaviorState,
} from "@/lib/sam-behavior";

import {
  updateSessionBrain,
  getSessionFocusScore,
} from "@/lib/sam-session-brain";

type AttentionPoint = {
  time: number;
  score: number;
  window: string;
  behavior: BehaviorState;
};

type ActiveContext = {
  app: string;
  title: string;
  attached_mode: boolean;
};

function fmt(n: number) { return Math.round(n); }

function timeStr() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function behaviorColor(b: BehaviorState): string {
  const map: Record<string, string> = {
    coding: "#00ff88",
    browsing: "#60b8ff",
    communicating: "#f0c060",
    designing: "#c084fc",
    reading: "#60d8ff",
    idle: "#444",
    distracted: "#ff6060",
    focused: "#00ff88",
  };
  return map[b] ?? "#60b8ff";
}

function AnimatedScore({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    const diff = end - start;
    if (diff === 0) return;
    let frame = 0;
    const total = 20;
    const id = setInterval(() => {
      frame++;
      setDisplay(start + (diff * frame) / total);
      if (frame >= total) { clearInterval(id); prev.current = end; }
    }, 16);
    return () => clearInterval(id);
  }, [value]);
  return <>{fmt(display)}</>;
}

function Sparkline({ data, color = "#60b8ff" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const w = 120, h = 32;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h * 0.85 - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <polyline points={`0,${h} ${pts} ${w},${h}`}
        fill={`url(#sg-${color.replace("#", "")})`} stroke="none" opacity="0.15" />
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function HexScore({ score, behavior }: { score: number; behavior: BehaviorState }) {
  const color = behaviorColor(behavior);
  const r = 54, circ = 2 * Math.PI * r;
  const pct = score / 100;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
      <svg width="140" height="140" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#111" strokeWidth="8" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color}
          strokeWidth="8" strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s ease", filter: `drop-shadow(0 0 6px ${color})` }}
        />
        {mounted && Array.from({ length: 20 }, (_, i) => {
          const angle = (i / 20) * 2 * Math.PI - Math.PI / 2;
          const inner = 46, outer = 50;
          return (
            <line key={i}
              x1={70 + inner * Math.cos(angle)} y1={70 + inner * Math.sin(angle)}
              x2={70 + outer * Math.cos(angle)} y2={70 + outer * Math.sin(angle)}
              stroke={i / 20 <= pct ? color : "#1a1a1a"} strokeWidth="1.5"
            />
          );
        })}
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          fontFamily: "'Orbitron', monospace", fontSize: "28px", fontWeight: 700,
          color, lineHeight: 1, letterSpacing: "-1px",
          textShadow: `0 0 20px ${color}`, transition: "color 0.5s",
        }}>
          <AnimatedScore value={score} />
        </div>
        <div style={{ fontSize: "9px", color: "#444", letterSpacing: "0.2em", fontFamily: "monospace" }}>
          FOCUS
        </div>
      </div>
    </div>
  );
}

function DataCard({ label, children, accent = "#60b8ff", style = {} }: {
  label: string; children: React.ReactNode; accent?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: "#080808", border: "1px solid #1a1a1a", borderRadius: "4px",
      padding: "14px 16px", position: "relative", overflow: "hidden", ...style,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, width: "3px", height: "100%",
        background: `linear-gradient(to bottom, ${accent}, transparent)`, opacity: 0.6,
      }} />
      <div style={{
        fontSize: "9px", letterSpacing: "0.2em", color: "#444",
        fontFamily: "'DM Mono', monospace", marginBottom: "8px", textTransform: "uppercase",
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Idea Board ───────────────────────────────────────────────────────────────

type IdeaTag = "idea" | "todo" | "bug" | "note" | "question";

interface Idea {
  id: string;
  title: string;
  body: string;
  tag: IdeaTag;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  x: number;
  y: number;
}

const IDEA_STORAGE_KEY = "sammy-idea-board-v3";
const CARD_W = 220;
const CARD_H = 52;
const BOARD_H = 560;

const TAG_META: Record<IdeaTag, { label: string; color: string; bg: string }> = {
  idea:     { label: "IDEA",     color: "#60b8ff", bg: "rgba(96,184,255,0.08)"  },
  todo:     { label: "TODO",     color: "#00ff88", bg: "rgba(0,255,136,0.07)"   },
  bug:      { label: "BUG",      color: "#ff6060", bg: "rgba(255,96,96,0.08)"   },
  note:     { label: "NOTE",     color: "#f0c060", bg: "rgba(240,192,96,0.08)"  },
  question: { label: "?",        color: "#c084fc", bg: "rgba(192,132,252,0.07)" },
};

const IDEA_TAGS: IdeaTag[] = ["idea", "todo", "bug", "note", "question"];

function loadIdeas(): Idea[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(IDEA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveIdeas(ideas: Idea[]) {
  try { localStorage.setItem(IDEA_STORAGE_KEY, JSON.stringify(ideas)); } catch {}
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// smooth cubic bezier between two points
function bezier(ax: number, ay: number, bx: number, by: number) {
  const cx = (bx - ax) * 0.5;
  return `M ${ax} ${ay} C ${ax + cx} ${ay}, ${bx - cx} ${by}, ${bx} ${by}`;
}

function TagPill({ tag, small = false }: { tag: IdeaTag; small?: boolean }) {
  const m = TAG_META[tag];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontFamily: "'DM Mono', monospace",
      fontSize: small ? "7px" : "8px", letterSpacing: "0.14em",
      color: m.color, background: m.bg,
      border: `1px solid ${m.color}28`, borderRadius: "3px",
      padding: small ? "1px 4px" : "2px 6px",
      flexShrink: 0, lineHeight: 1.4,
    }}>
      {m.label}
    </span>
  );
}

function TagSelect({ value, onChange }: { value: IdeaTag; onChange: (t: IdeaTag) => void }) {
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {IDEA_TAGS.map(t => {
        const m = TAG_META[t];
        const active = value === t;
        return (
          <button key={t} onClick={() => onChange(t)} style={{
            background: active ? m.bg : "transparent",
            border: `1px solid ${active ? m.color + "55" : "#1e1e28"}`,
            borderRadius: "4px", color: active ? m.color : "#383848",
            fontSize: "9px", letterSpacing: "0.15em", padding: "3px 10px",
            cursor: "pointer", fontFamily: "'DM Mono', monospace", transition: "all 0.12s",
          }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = m.color + "44"; e.currentTarget.style.color = m.color + "aa"; }}}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = "#1e1e28"; e.currentTarget.style.color = "#383848"; }}}
          >{m.label}</button>
        );
      })}
    </div>
  );
}

function EditModal({ initial, onSave, onClose }: {
  initial?: Idea | null;
  onSave: (d: { title: string; body: string; tag: IdeaTag }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [tag, setTag] = useState<IdeaTag>(initial?.tag ?? "idea");
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 30); }, []);
  const canSave = title.trim().length > 0;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(5,5,7,0.88)",
      backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 200, animation: "ideaFadeIn 0.12s ease",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "min(460px, 92vw)", background: "#0a0a0f",
        border: "1px solid #1e1e2e", borderRadius: "10px", overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.95)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #12121a" }}>
          <span style={{ fontSize: "9px", letterSpacing: "0.2em", color: "#444", fontFamily: "'DM Mono', monospace" }}>
            {initial ? "EDIT IDEA" : "NEW IDEA"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#333", fontSize: "16px", cursor: "pointer", lineHeight: 1 }}
            onMouseEnter={e => e.currentTarget.style.color = "#888"}
            onMouseLeave={e => e.currentTarget.style.color = "#333"}>×</button>
        </div>
        <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "0.15em", color: "#333", fontFamily: "'DM Mono', monospace", marginBottom: "6px" }}>TITLE</div>
            <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") onClose(); }}
              placeholder="Give it a name…"
              style={{
                display: "block", width: "100%", boxSizing: "border-box",
                background: "#060608", border: "1px solid #1a1a24", borderRadius: "6px",
                color: "#d8d8e8", fontFamily: "'DM Mono', monospace", fontSize: "13px",
                padding: "9px 12px", outline: "none", caretColor: "#60b8ff", transition: "border-color 0.15s",
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#60b8ff44"}
              onBlur={e => e.currentTarget.style.borderColor = "#1a1a24"}
            />
          </div>
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "0.15em", color: "#333", fontFamily: "'DM Mono', monospace", marginBottom: "6px" }}>
              DETAILS <span style={{ color: "#252530" }}>— optional</span>
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") onClose(); }}
              placeholder="More context, links, notes…" rows={4}
              style={{
                display: "block", width: "100%", boxSizing: "border-box",
                background: "#060608", border: "1px solid #1a1a24", borderRadius: "6px",
                color: "#a0a0b8", fontFamily: "'DM Mono', monospace", fontSize: "11px",
                lineHeight: 1.7, padding: "9px 12px", outline: "none",
                resize: "vertical", minHeight: "80px", caretColor: "#60b8ff", transition: "border-color 0.15s",
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#60b8ff44"}
              onBlur={e => e.currentTarget.style.borderColor = "#1a1a24"}
            />
          </div>
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "0.15em", color: "#333", fontFamily: "'DM Mono', monospace", marginBottom: "6px" }}>TAG</div>
            <TagSelect value={tag} onChange={setTag} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 18px", borderTop: "1px solid #0f0f18", background: "#080810" }}>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid #1e1e28", borderRadius: "5px",
            color: "#383848", fontSize: "10px", padding: "6px 16px", cursor: "pointer",
            fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", transition: "all 0.12s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#666"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e28"; e.currentTarget.style.color = "#383848"; }}
          >CANCEL</button>
          <button onClick={() => { if (canSave) onSave({ title: title.trim(), body: body.trim(), tag }); }}
            disabled={!canSave} style={{
              background: canSave ? "rgba(96,184,255,0.09)" : "transparent",
              border: `1px solid ${canSave ? "rgba(96,184,255,0.28)" : "#1e1e28"}`,
              borderRadius: "5px", color: canSave ? "#60b8ff" : "#282838",
              fontSize: "10px", padding: "6px 16px",
              cursor: canSave ? "pointer" : "default",
              fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", transition: "all 0.12s",
            }}>SAVE</button>
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({ idea, onClose, onEdit, onDelete, onTogglePin }: {
  idea: Idea; onClose: () => void; onEdit: () => void; onDelete: () => void; onTogglePin: () => void;
}) {
  const m = TAG_META[idea.tag];
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(5,5,7,0.72)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end",
      justifyContent: "center", zIndex: 200, animation: "ideaFadeIn 0.15s ease",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "min(580px, 96vw)", background: "#0a0a0f",
        border: "1px solid #1e1e2e", borderTop: `2px solid ${m.color}55`,
        borderRadius: "10px 10px 0 0", overflow: "hidden",
        boxShadow: "0 -24px 60px rgba(0,0,0,0.85)",
        animation: "drawerSlideUp 0.2s cubic-bezier(0.16,1,0.3,1)",
        maxHeight: "65vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <TagPill tag={idea.tag} />
            <span style={{ fontSize: "9px", color: "#2e2e3e", fontFamily: "'DM Mono', monospace" }}>{timeAgo(idea.updatedAt)}</span>
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button onClick={onTogglePin} title={idea.pinned ? "Unpin" : "Pin"} style={{
              background: idea.pinned ? "rgba(240,192,96,0.08)" : "none",
              border: `1px solid ${idea.pinned ? "rgba(240,192,96,0.25)" : "#1e1e28"}`,
              borderRadius: "4px", color: idea.pinned ? "#f0c060" : "#333",
              fontSize: "11px", width: 26, height: 26,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.12s",
            }}
              onMouseEnter={e => { if (!idea.pinned) { e.currentTarget.style.color = "#888"; e.currentTarget.style.borderColor = "#333"; }}}
              onMouseLeave={e => { if (!idea.pinned) { e.currentTarget.style.color = "#333"; e.currentTarget.style.borderColor = "#1e1e28"; }}}
            >{idea.pinned ? "★" : "☆"}</button>
            <button onClick={onEdit} style={{
              background: "none", border: "1px solid #1e1e28", borderRadius: "4px",
              color: "#333", fontSize: "9px", letterSpacing: "0.12em",
              padding: "0 8px", height: 26, cursor: "pointer",
              fontFamily: "'DM Mono', monospace", transition: "all 0.12s",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = "#60b8ff"; e.currentTarget.style.borderColor = "#60b8ff44"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#333"; e.currentTarget.style.borderColor = "#1e1e28"; }}
            >EDIT</button>
            <button onClick={onDelete} style={{
              background: "none", border: "1px solid #1e1e28", borderRadius: "4px",
              color: "#333", fontSize: "9px", letterSpacing: "0.12em",
              padding: "0 8px", height: 26, cursor: "pointer",
              fontFamily: "'DM Mono', monospace", transition: "all 0.12s",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = "#ff6060"; e.currentTarget.style.borderColor = "#ff606044"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#333"; e.currentTarget.style.borderColor = "#1e1e28"; }}
            >DELETE</button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#2e2e3e", fontSize: "18px", cursor: "pointer", lineHeight: 1, padding: "2px 4px" }}
              onMouseEnter={e => e.currentTarget.style.color = "#888"}
              onMouseLeave={e => e.currentTarget.style.color = "#2e2e3e"}>×</button>
          </div>
        </div>
        <div style={{ padding: "4px 18px 28px", overflowY: "auto" }}>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: "16px", fontWeight: 600,
            color: "#e0e0f0", lineHeight: 1.4, marginBottom: idea.body ? "14px" : 0,
          }}>{idea.title}</div>
          {idea.body ? (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "#767688", lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {idea.body}
            </div>
          ) : (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "#1e1e28" }}>
              No details — tap Edit to add some.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Canvas Board ──────────────────────────────────────────────────────────────

function IdeaBoard() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [detailIdea, setDetailIdea] = useState<Idea | null>(null);
  const [boardSize, setBoardSize] = useState({ w: 800, h: BOARD_H });
  const boardRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  useEffect(() => { setIdeas(loadIdeas()); setMounted(true); }, []);
  useEffect(() => { if (mounted) saveIdeas(ideas); }, [ideas, mounted]);

  useEffect(() => {
    if (detailIdea) {
      const updated = ideas.find(i => i.id === detailIdea.id);
      if (updated) setDetailIdea(updated); else setDetailIdea(null);
    }
  }, [ideas]);

  useEffect(() => {
    if (!boardRef.current) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      setBoardSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, []);

  const createIdea = useCallback((data: { title: string; body: string; tag: IdeaTag }) => {
    const now = Date.now();
    const bw = boardRef.current?.clientWidth ?? 800;
    const bh = boardRef.current?.clientHeight ?? BOARD_H;
    const x = 40 + Math.random() * Math.max(0, bw - CARD_W - 80);
    const y = 40 + Math.random() * Math.max(0, bh - CARD_H - 80);
    setIdeas(prev => [{ ...data, id: crypto.randomUUID(), pinned: false, createdAt: now, updatedAt: now, x, y }, ...prev]);
    setShowModal(false);
  }, []);

  const updateIdea = useCallback((id: string, data: { title: string; body: string; tag: IdeaTag }) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, ...data, updatedAt: Date.now() } : i));
    setEditingIdea(null);
  }, []);

  const deleteIdea = useCallback((id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id));
    setDetailIdea(null);
  }, []);

  const togglePin = useCallback((id: string) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, pinned: !i.pinned } : i));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;
    const board = boardRef.current?.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - (board?.left ?? 0) - idea.x,
      y: e.clientY - (board?.top ?? 0) - idea.y,
    };
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;
    setDragging(id);
  }, [ideas]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag.current = true;
      const board = boardRef.current?.getBoundingClientRect();
      if (!board) return;
      const x = Math.max(0, Math.min(e.clientX - board.left - dragOffset.current.x, board.width - CARD_W));
      const y = Math.max(0, Math.min(e.clientY - board.top - dragOffset.current.y, board.height - CARD_H));
      setIdeas(prev => prev.map(c => c.id === dragging ? { ...c, x, y } : c));
    };
    const onUp = (e: MouseEvent) => {
      if (!didDrag.current) {
        // it was a click — open detail
        const idea = ideas.find(i => i.id === dragging);
        if (idea) setDetailIdea(idea);
      }
      setDragging(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, ideas]);

  // card center
  const center = (idea: Idea) => ({
    x: idea.x + CARD_W / 2,
    y: idea.y + CARD_H / 2,
  });

  // sort: pinned on top, then by time
  const sorted = [...ideas].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <>
      {showModal && !editingIdea && (
        <EditModal initial={null} onSave={createIdea} onClose={() => setShowModal(false)} />
      )}
      {editingIdea && (
        <EditModal initial={editingIdea}
          onSave={data => updateIdea(editingIdea.id, data)}
          onClose={() => setEditingIdea(null)}
        />
      )}
      {detailIdea && !editingIdea && (
        <DetailDrawer idea={detailIdea}
          onClose={() => setDetailIdea(null)}
          onEdit={() => { setEditingIdea(detailIdea); setDetailIdea(null); }}
          onDelete={() => deleteIdea(detailIdea.id)}
          onTogglePin={() => togglePin(detailIdea.id)}
        />
      )}

      <div style={{ marginTop: "16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.2em", color: "#444", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>
            Ideas
          </div>
          {ideas.length > 0 && (
            <div style={{ fontSize: "9px", color: "#252535", fontFamily: "'DM Mono', monospace" }}>{ideas.length}</div>
          )}
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, #1a1a1a, transparent)" }} />
          <div style={{ fontSize: "9px", color: "#1e1e28", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em" }}>
            drag to arrange · click to open
          </div>
          <button onClick={() => { setEditingIdea(null); setShowModal(true); }} style={{
            background: "rgba(96,184,255,0.06)", border: "1px solid rgba(96,184,255,0.18)",
            borderRadius: "5px", color: "#60b8ff", fontSize: "9px", letterSpacing: "0.15em",
            padding: "4px 12px", cursor: "pointer", fontFamily: "'DM Mono', monospace",
            transition: "all 0.12s", display: "flex", alignItems: "center", gap: "5px",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(96,184,255,0.12)"; e.currentTarget.style.borderColor = "rgba(96,184,255,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(96,184,255,0.06)"; e.currentTarget.style.borderColor = "rgba(96,184,255,0.18)"; }}
          >
            <span style={{ fontSize: "14px", lineHeight: 1, marginTop: "-1px" }}>+</span> NEW
          </button>
        </div>

        {/* Canvas */}
        <div ref={boardRef} style={{
          position: "relative",
          width: "100%",
          height: `${BOARD_H}px`,
          background: "#040406",
          border: "1px solid #111116",
          borderRadius: "10px",
          overflow: "hidden",
          userSelect: dragging ? "none" : "auto",
          // dot grid
          backgroundImage: "radial-gradient(circle, #161620 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}>
          {/* SVG connection layer */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}
            width={boardSize.w} height={boardSize.h}>
            <defs>
              {/* animated dash offset for "live" feel */}
              <style>{`
                .idea-conn { animation: connFlow 4s linear infinite; }
                @keyframes connFlow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -40; } }
              `}</style>
            </defs>

            {/* Connection lines */}
            {ideas.map((a, i) =>
              ideas.slice(i + 1).map(b => {
                const ca = center(a);
                const cb = center(b);
                const aColor = TAG_META[a.tag].color;
                const bColor = TAG_META[b.tag].color;
                const gradId = `conn-${a.id.slice(0,4)}-${b.id.slice(0,4)}`;
                const isActiveConn = dragging === a.id || dragging === b.id || hovered === a.id || hovered === b.id;
                return (
                  <g key={`${a.id}-${b.id}`}>
                    <defs>
                      <linearGradient id={gradId} gradientUnits="userSpaceOnUse"
                        x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}>
                        <stop offset="0%" stopColor={aColor} stopOpacity={isActiveConn ? 0.45 : 0.12} />
                        <stop offset="100%" stopColor={bColor} stopOpacity={isActiveConn ? 0.45 : 0.12} />
                      </linearGradient>
                    </defs>
                    <path
                      d={bezier(ca.x, ca.y, cb.x, cb.y)}
                      fill="none"
                      stroke={`url(#${gradId})`}
                      strokeWidth={isActiveConn ? "1.5" : "1"}
                      strokeDasharray="6 7"
                      className="idea-conn"
                      style={{ transition: "stroke-width 0.2s" }}
                    />
                  </g>
                );
              })
            )}

            {/* Node dots at card centers */}
            {ideas.map(idea => {
              const { x, y } = center(idea);
              const color = TAG_META[idea.tag].color;
              const isActive = dragging === idea.id;
              const isHov = hovered === idea.id && !dragging;
              return (
                <g key={`node-${idea.id}`}>
                  <circle cx={x} cy={y} r={isActive ? 16 : isHov ? 13 : 9}
                    fill="none"
                    stroke={color}
                    strokeOpacity={isActive ? 0.3 : isHov ? 0.2 : 0.08}
                    strokeWidth="1"
                    style={{ transition: "r 0.2s, stroke-opacity 0.2s" }}
                  />
                  <circle cx={x} cy={y} r={isActive ? 5 : isHov ? 4 : 3}
                    fill={color}
                    fillOpacity={isActive ? 0.9 : isHov ? 0.7 : 0.35}
                    style={{ transition: "r 0.15s, fill-opacity 0.15s" }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Cards */}
          {sorted.map(idea => {
            const m = TAG_META[idea.tag];
            const isActive = dragging === idea.id;
            const isHov = hovered === idea.id && !dragging;

            return (
              <div key={idea.id}
                onMouseDown={e => onMouseDown(e, idea.id)}
                onMouseEnter={() => setHovered(idea.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  position: "absolute",
                  left: idea.x,
                  top: idea.y,
                  width: CARD_W,
                  height: CARD_H,
                  zIndex: isActive ? 20 : isHov ? 10 : 3,
                  cursor: isActive ? "grabbing" : "grab",
                  // horizontal pill shape
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "0 14px 0 12px",
                  background: isActive
                    ? `rgba(12,12,18,0.98)`
                    : `rgba(8,8,12,0.92)`,
                  border: `1px solid ${isActive
                    ? m.color + "60"
                    : isHov
                    ? m.color + "40"
                    : m.color + "18"}`,
                  borderRadius: "26px",
                  backdropFilter: "blur(12px)",
                  boxShadow: isActive
                    ? `0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px ${m.color}20, inset 0 1px 0 ${m.color}18`
                    : isHov
                    ? `0 6px 24px rgba(0,0,0,0.5), 0 0 0 1px ${m.color}12, inset 0 1px 0 ${m.color}10`
                    : `0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 ${m.color}06`,
                  transform: isActive ? "scale(1.04) translateY(-2px)" : "scale(1)",
                  transition: isActive ? "none" : "border-color 0.2s, box-shadow 0.2s, background 0.2s, transform 0.15s",
                }}
              >
                {/* Pin star */}
                {idea.pinned && (
                  <span style={{ fontSize: "9px", color: "#f0c060", flexShrink: 0, opacity: 0.8 }}>★</span>
                )}

                {/* Color dot */}
                <div style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: m.color,
                  opacity: isActive ? 1 : isHov ? 0.85 : 0.5,
                  boxShadow: isActive || isHov ? `0 0 8px ${m.color}` : "none",
                  transition: "opacity 0.2s, box-shadow 0.2s",
                }} />

                {/* Tag + title */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <TagPill tag={idea.tag} small />
                    {idea.body.length > 0 && (
                      <div style={{ width: 3, height: 3, borderRadius: "50%", background: m.color, opacity: 0.4, flexShrink: 0 }} />
                    )}
                  </div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "11px",
                    color: isActive ? "#e8e8f0" : isHov ? "#d0d0e0" : "#b0b0c8",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    letterSpacing: "0.01em",
                    transition: "color 0.2s",
                    lineHeight: 1.3,
                  }}>
                    {idea.title}
                  </div>
                </div>

                {/* Timestamp */}
                <div style={{
                  fontSize: "8px", color: "#1e1e2e", fontFamily: "'DM Mono', monospace",
                  flexShrink: 0, letterSpacing: "0.03em",
                  opacity: isHov || isActive ? 1 : 0,
                  transition: "opacity 0.2s",
                }}>
                  {timeAgo(idea.updatedAt)}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {ideas.length === 0 && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "12px",
              pointerEvents: "none",
            }}>
              <svg width="90" height="56" style={{ opacity: 0.12 }}>
                <line x1="12" y1="28" x2="42" y2="14" stroke="#60b8ff" strokeWidth="1" strokeDasharray="3 5" />
                <line x1="12" y1="28" x2="42" y2="42" stroke="#60b8ff" strokeWidth="1" strokeDasharray="3 5" />
                <line x1="42" y1="14" x2="72" y2="28" stroke="#60b8ff" strokeWidth="1" strokeDasharray="3 5" />
                <line x1="42" y1="42" x2="72" y2="28" stroke="#60b8ff" strokeWidth="1" strokeDasharray="3 5" />
                <circle cx="12" cy="28" r="5" fill="#60b8ff" />
                <circle cx="42" cy="14" r="4" fill="#c084fc" />
                <circle cx="42" cy="42" r="4" fill="#00ff88" />
                <circle cx="72" cy="28" r="5" fill="#f0c060" />
              </svg>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "#1a1a22", letterSpacing: "0.16em" }}>
                NO IDEAS YET — HIT + NEW TO START
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [activeWindow, setActiveWindow] = useState("—");
  const [history, setHistory] = useState<string[]>([]);
  const [behavior, setBehavior] = useState<BehaviorState>("idle");
  const [insight, setInsight] = useState("Initializing neural observer…");
  const [focusScore, setFocusScore] = useState(0);
  const [attention, setAttention] = useState<AttentionPoint[]>([]);
  const [sessionStart] = useState(() => Date.now());
  const [sessionDuration, setSessionDuration] = useState("00:00");
  const [clock, setClock] = useState("");
  const lastSignatureRef = useRef("");
  const unlistenRef = useRef<null | (() => void)>(null);

  const { ping } = useTelemetry();

  useEffect(() => {
    setClock(timeStr());
    const id = setInterval(() => setClock(timeStr()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
      const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
      const s = (elapsed % 60).toString().padStart(2, "0");
      setSessionDuration(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStart]);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      const unlisten = await listen("active-window", (event) => {
        if (!mounted) return;
        const payload = event.payload as ActiveContext;
        if (!payload) return;
        const app = payload.app ?? "Unknown";
        const title = payload.title ?? "Unknown";
        const display = `${app} — ${title}`;
        const detectedBehavior = interpretBehavior(display);
        const signature = `${display}::${detectedBehavior}`;
        if (signature === lastSignatureRef.current) return;
        lastSignatureRef.current = signature;
        setActiveWindow(display);
        setBehavior(detectedBehavior);
        const session = updateSessionBrain(detectedBehavior);
        const score = getSessionFocusScore(session);
        setFocusScore(score);
        setAttention((prev) =>
          [{ time: Date.now(), score, window: display, behavior: detectedBehavior }, ...prev].slice(0, 60)
        );
        setHistory((prev) => prev[0] === display ? prev : [display, ...prev].slice(0, 8));
        setInsight(getSamInsight(detectedBehavior));
      });
      unlistenRef.current = unlisten;
    };
    setup();
    return () => { mounted = false; unlistenRef.current?.(); };
  }, []);

  const scoreHistory = attention.slice(0, 30).reverse().map((a) => a.score);
  const bColor = behaviorColor(behavior);
  const avgScore = attention.length > 0
    ? Math.round(attention.reduce((a, b) => a + b.score, 0) / attention.length) : 0;

  return (
    <div style={{
      height: "100%", overflowY: "auto", overflowX: "hidden",
      background: "#050505", color: "#e0e0e0",
      fontFamily: "'DM Mono', 'Fira Mono', monospace", position: "relative",
    }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(rgba(96,184,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(96,184,255,0.025) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
      }} />

      <div style={{ position: "relative", zIndex: 1, padding: "20px 24px 32px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "0.28em", color: "#333", marginBottom: "4px", fontFamily: "monospace" }}>
              Sammy OS // NEURAL COMMAND CENTER
            </div>
            <div style={{
              fontSize: "26px", fontWeight: 700, letterSpacing: "-0.03em",
              fontFamily: "'Orbitron', monospace",
              background: "linear-gradient(135deg, #e8e8e8 0%, #888 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Live Brain
            </div>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
            <div style={{
              fontFamily: "'Orbitron', monospace", fontSize: "22px",
              color: "#60b8ff", letterSpacing: "0.1em",
              textShadow: "0 0 20px rgba(96,184,255,0.4)", minWidth: "90px",
            }}>
              {clock}
            </div>
            <div style={{ fontSize: "9px", color: "#333", letterSpacing: "0.15em" }}>SESSION {sessionDuration}</div>
          </div>
        </div>

        {/* Hero row */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "16px", marginBottom: "16px", alignItems: "stretch" }}>
          <div style={{
            background: "#080808", border: "1px solid #1a1a1a", borderRadius: "4px",
            padding: "20px 24px", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "12px",
          }}>
            <HexScore score={fmt(focusScore)} behavior={behavior} />
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "11px", fontWeight: 700, color: bColor, textTransform: "uppercase",
                letterSpacing: "0.15em", textShadow: `0 0 10px ${bColor}`, transition: "color 0.5s, text-shadow 0.5s",
              }}>
                {behavior.replace("_", " ")}
              </div>
              {avgScore > 0 && (
                <div style={{ fontSize: "9px", color: "#333", marginTop: "3px", letterSpacing: "0.1em" }}>
                  AVG {avgScore} / SESSION
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <DataCard label="Active Window" accent={bColor} style={{ flex: 1 }}>
              <div style={{
                fontSize: "13px", color: "#e0e0e0", fontWeight: 600,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                fontFamily: "'DM Mono', monospace",
              }}>{activeWindow}</div>
            </DataCard>
            <DataCard label="Sam Insight" accent="#c084fc" style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", color: "#a0a0a0", lineHeight: 1.5, fontFamily: "'DM Mono', monospace" }}>
                {insight}
              </div>
            </DataCard>
            <DataCard label="Focus Timeline" accent="#60b8ff">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Sparkline data={scoreHistory} color={bColor} />
                <div style={{ fontSize: "9px", color: "#333", letterSpacing: "0.1em" }}>{scoreHistory.length} samples</div>
              </div>
            </DataCard>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
          <DataCard label="Session Events" accent="#f0c060">
            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: "28px", color: "#f0c060", fontWeight: 700, lineHeight: 1, textShadow: "0 0 16px rgba(240,192,96,0.4)" }}>
              {attention.length}
            </div>
          </DataCard>
          <DataCard label="Windows Tracked" accent="#c084fc">
            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: "28px", color: "#c084fc", fontWeight: 700, lineHeight: 1, textShadow: "0 0 16px rgba(192,132,252,0.4)" }}>
              {new Set(attention.map((a) => a.window.split(" — ")[0])).size}
            </div>
          </DataCard>
          <DataCard label="Peak Focus" accent="#00ff88">
            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: "28px", color: "#00ff88", fontWeight: 700, lineHeight: 1, textShadow: "0 0 16px rgba(0,255,136,0.4)" }}>
              {attention.length > 0 ? Math.round(Math.max(...attention.map((a) => a.score))) : 0}
            </div>
          </DataCard>
        </div>

        {/* Attention log + activity */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <DataCard label="Attention Log" accent="#60b8ff">
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto" }}>
              {attention.length === 0 && <div style={{ fontSize: "11px", color: "#333" }}>Awaiting signal…</div>}
              {attention.slice(0, 20).map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 0", borderBottom: "1px solid #0f0f0f", opacity: 1 - i * 0.04 }}>
                  <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: behaviorColor(a.behavior), flexShrink: 0, boxShadow: `0 0 4px ${behaviorColor(a.behavior)}` }} />
                  <div style={{ flex: 1, fontSize: "10px", color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "monospace" }}>
                    {a.window.split(" — ")[0]}
                  </div>
                  <div style={{ fontSize: "10px", fontFamily: "'Orbitron', monospace", color: behaviorColor(a.behavior), flexShrink: 0, minWidth: "28px", textAlign: "right" }}>
                    {fmt(a.score)}
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
          <DataCard label="Recent Activity" accent="#f0c060">
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {history.length === 0 && <div style={{ fontSize: "11px", color: "#333" }}>No activity yet…</div>}
              {history.map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px",
                  background: i === 0 ? "rgba(240,192,96,0.04)" : "transparent",
                  border: i === 0 ? "1px solid rgba(240,192,96,0.12)" : "1px solid transparent",
                  borderRadius: "3px", opacity: 1 - i * 0.1,
                }}>
                  <div style={{ fontSize: "9px", color: i === 0 ? "#f0c060" : "#333", fontFamily: "'Orbitron', monospace", flexShrink: 0, letterSpacing: "0.05em" }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ fontSize: "11px", color: i === 0 ? "#e0e0e0" : "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "monospace" }}>
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        </div>

        {/* Behavior distribution */}
        {attention.length > 3 && (() => {
          const counts: Record<string, number> = {};
          attention.forEach((a) => { counts[a.behavior] = (counts[a.behavior] ?? 0) + 1; });
          const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          const total = attention.length;
          return (
            <div style={{ marginTop: "12px" }}>
              <DataCard label="Behavior Distribution" accent="#888">
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {sorted.map(([b, count]) => {
                    const pct = count / total;
                    const color = behaviorColor(b as BehaviorState);
                    return (
                      <div key={b} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ fontSize: "9px", color, letterSpacing: "0.12em", textTransform: "uppercase", width: "90px", flexShrink: 0, fontFamily: "monospace" }}>{b}</div>
                        <div style={{ flex: 1, height: "3px", background: "#111", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct * 100}%`, background: color, boxShadow: `0 0 6px ${color}`, transition: "width 0.5s ease", borderRadius: "2px" }} />
                        </div>
                        <div style={{ fontSize: "9px", color: "#444", width: "34px", textAlign: "right", fontFamily: "'Orbitron', monospace", flexShrink: 0 }}>
                          {Math.round(pct * 100)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DataCard>
            </div>
          );
        })()}

        {/* Idea Board */}
        <IdeaBoard />

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadeInModal { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes ideaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drawerSlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 2px; }
      `}</style>
    </div>
  );
}