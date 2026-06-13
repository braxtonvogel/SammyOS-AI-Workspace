/**
 * SammyOS — Vault File Viewer Modal
 * File: apps/desktop/components/vault/FileViewerModal.tsx
 *
 * Full-screen modal that renders any vault file's content.
 * - Markdown files: rendered as formatted markdown
 * - Code files: rendered in a dark code block with the language detected
 *   from the file extension, line numbers, and copy button
 * - Plain text: clean monospace view
 *
 * Triggered by the "View" button on FileCard, FolderCard file rows,
 * and the CODEBASE_SUMMARY / CODE_EXAMPLES badges.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface VaultFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  preview: string;
}

interface FileViewerModalProps {
  file: VaultFile | null;
  onClose: () => void;
}

// ─── Language detection from file extension ───────────────────────────────────
function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", java: "java", rs: "rust", go: "go", cs: "csharp",
    cpp: "cpp", c: "c", rb: "ruby", php: "php", swift: "swift",
    kt: "kotlin", md: "markdown", json: "json", yaml: "yaml", yml: "yaml",
    toml: "toml", html: "html", css: "css", scss: "scss", sql: "sql",
    sh: "bash", bash: "bash", zsh: "bash", txt: "text",
  };
  return map[ext] ?? "text";
}

// ─── Simple markdown renderer (no dependencies) ───────────────────────────────
function renderMarkdown(content: string): string {
  return content
    // Code blocks (must come before inline code)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="nvmd-code" data-lang="${lang}"><code>${escapeHtml(code.trimEnd())}</code></pre>`
    )
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="nvmd-inline">$1</code>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="nvmd-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="nvmd-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="nvmd-h1">$1</h1>')
    // Bold / italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="nvmd-hr" />')
    // Unordered lists
    .replace(/^\* (.+)$/gm, '<li class="nvmd-li">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="nvmd-li">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="nvmd-li nvmd-oli">$1</li>')
    // Paragraphs (double newlines)
    .replace(/\n\n(?!<)/g, '</p><p class="nvmd-p">')
    // Wrap in opening paragraph
    .replace(/^(?!<)/, '<p class="nvmd-p">')
    .replace(/$(?!>)/, "</p>");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Line-numbered code view ──────────────────────────────────────────────────
function CodeView({ content, language }: { content: string; language: string }) {
  const lines = content.split("\n");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ position: "relative", height: "100%" }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", background: "#161616",
        borderBottom: "1px solid #222", flexShrink: 0,
      }}>
        <span style={{ fontSize: "11px", color: "#555", fontFamily: "monospace", letterSpacing: "0.06em" }}>
          {language.toUpperCase()} · {lines.length} lines
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? "rgba(74,170,120,0.15)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${copied ? "rgba(74,170,120,0.4)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: "5px", color: copied ? "#4aaa78" : "#888",
            padding: "4px 12px", fontSize: "11px", cursor: "pointer",
            fontFamily: "monospace", transition: "all 0.2s",
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Code with line numbers */}
      <div style={{
        overflowY: "auto", overflowX: "auto",
        height: "calc(100% - 37px)",
        fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
        fontSize: "12.5px", lineHeight: "1.65",
      }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ verticalAlign: "top" }}>
                <td style={{
                  padding: "0 16px 0 12px", color: "#3a3a3a",
                  userSelect: "none", textAlign: "right",
                  minWidth: "48px", fontSize: "11px", lineHeight: "1.65",
                  borderRight: "1px solid #1e1e1e", position: "sticky", left: 0,
                  background: "#0d0d0d",
                }}>
                  {i + 1}
                </td>
                <td style={{ padding: "0 16px", color: "#c8c8c8", whiteSpace: "pre" }}>
                  {line || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function FileViewerModal({ file, onClose }: FileViewerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!file) return null;

  const language = detectLanguage(file.name);
  const isMarkdown = language === "markdown";
  const isCode = !isMarkdown && language !== "text";
  const shortName = file.name.split("/").pop() ?? file.name;

  // Search highlight helper
  const highlightedContent = searchQuery.trim()
    ? file.content.replace(
        new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
        "==HIGHLIGHT==$1==ENDHIGHLIGHT=="
      )
    : file.content;

  const handleCopyAll = () => {
    navigator.clipboard.writeText(file.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
        animation: "nvModalIn 0.18s ease",
      }}
    >
      <div style={{
        width: "100%", maxWidth: "900px",
        height: "100%", maxHeight: "85vh",
        background: "#0d0d0d",
        border: "1px solid #2a2a2a",
        borderRadius: "12px",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
      }}>
        {/* ── Modal header ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "14px 18px",
          borderBottom: "1px solid #1e1e1e",
          background: "#111", flexShrink: 0,
        }}>
          {/* File icon */}
          <div style={{
            width: "32px", height: "32px", borderRadius: "6px",
            background: isMarkdown ? "rgba(96,184,255,0.1)" : "rgba(255,200,80,0.1)",
            border: `1px solid ${isMarkdown ? "rgba(96,184,255,0.2)" : "rgba(255,200,80,0.2)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", flexShrink: 0,
          }}>
            {isMarkdown ? "📄" : isCode ? "💻" : "📝"}
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{
              fontSize: "14px", fontWeight: 700, color: "#e8e8e8",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {shortName}
            </div>
            <div style={{ fontSize: "11px", color: "#555", marginTop: "1px" }}>
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>

          {/* Search */}
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in file…"
            style={{
              background: "#1a1a1a", border: "1px solid #2a2a2a",
              borderRadius: "6px", color: "#e0e0e0",
              padding: "6px 12px", fontSize: "12px", outline: "none",
              width: "180px", fontFamily: "inherit",
            }}
          />

          {/* Copy all */}
          <button
            onClick={handleCopyAll}
            title="Copy full content"
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid #2a2a2a",
              borderRadius: "6px", color: copied ? "#4aaa78" : "#888",
              padding: "6px 12px", cursor: "pointer", fontSize: "12px",
              transition: "color 0.2s",
            }}
          >
            {copied ? "✓ Copied" : "Copy all"}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              background: "none", border: "none", color: "#555",
              cursor: "pointer", fontSize: "20px", lineHeight: 1,
              padding: "4px 8px", borderRadius: "4px",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e0e0e0")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
          >
            ✕
          </button>
        </div>

        {/* ── Content area ── */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {isCode ? (
            // Code view with line numbers
            <CodeView content={file.content} language={language} />
          ) : isMarkdown ? (
            // Markdown rendered view
            <div style={{ height: "100%", overflowY: "auto", padding: "24px 32px" }}>
              {searchQuery.trim() ? (
                // Plain text with highlights when searching
                <pre style={{
                  fontFamily: "inherit", whiteSpace: "pre-wrap",
                  wordBreak: "break-word", color: "#c8c8c8",
                  fontSize: "13.5px", lineHeight: 1.75,
                }}>
                  {highlightedContent.split("==HIGHLIGHT==").map((part, i) => {
                    if (i === 0) return part;
                    const [match, rest] = part.split("==ENDHIGHLIGHT==");
                    return (
                      <span key={i}>
                        <mark style={{ background: "rgba(255,200,80,0.3)", color: "#ffe066", borderRadius: "2px" }}>
                          {match}
                        </mark>
                        {rest}
                      </span>
                    );
                  })}
                </pre>
              ) : (
                <div
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(file.content) }}
                  style={{ color: "#c8c8c8" }}
                />
              )}
              <style>{`
                .nvmd-h1 { font-size: 22px; font-weight: 700; color: #e8e8e8; margin: 24px 0 12px; border-bottom: 1px solid #222; padding-bottom: 8px; }
                .nvmd-h2 { font-size: 17px; font-weight: 700; color: #ddd; margin: 20px 0 8px; }
                .nvmd-h3 { font-size: 14px; font-weight: 700; color: #ccc; margin: 16px 0 6px; }
                .nvmd-p  { margin: 0 0 12px; line-height: 1.75; font-size: 13.5px; }
                .nvmd-hr { border: none; border-top: 1px solid #222; margin: 20px 0; }
                .nvmd-li { margin: 4px 0 4px 20px; line-height: 1.65; font-size: 13.5px; list-style: disc; }
                .nvmd-oli { list-style: decimal; }
                .nvmd-inline { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 3px; padding: 1px 5px; font-family: monospace; font-size: 12px; color: #e0c080; }
                .nvmd-code { background: #141414; border: 1px solid #222; border-radius: 6px; padding: 14px 16px; margin: 12px 0; overflow-x: auto; font-family: 'Fira Code', monospace; font-size: 12px; line-height: 1.65; color: #c8c8c8; white-space: pre; }
                .nvmd-code[data-lang]::before { content: attr(data-lang); display: block; color: #444; font-size: 10px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.1em; }
              `}</style>
            </div>
          ) : (
            // Plain text
            <div style={{ height: "100%", overflowY: "auto", padding: "20px 24px" }}>
              <pre style={{
                fontFamily: "'Fira Code', monospace", fontSize: "13px",
                lineHeight: 1.65, color: "#c0c0c0",
                whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
              }}>
                {file.content}
              </pre>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes nvModalIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}