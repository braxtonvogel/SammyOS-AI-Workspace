"use client";

import { useState } from "react";
import {
  CARD_STYLE, LABEL_STYLE, TEXTAREA_STYLE, BUTTON_STYLE,
  BUTTON_DISABLED_STYLE, SELECT_STYLE, CODE_BLOCK,
  callSam, parseJSON,
} from "./qa-lab-utils";

type Framework = "playwright" | "cypress" | "selenium";

interface GeneratedScript {
  framework: Framework;
  language: string;
  filename: string;
  code: string;
  testCount: number;
  notes: string[];
}

const FRAMEWORK_META: Record<Framework, { label: string; icon: string; lang: string }> = {
  playwright: { label: "Playwright", icon: "🎭", lang: "TypeScript" },
  cypress:    { label: "Cypress",    icon: "🌲", lang: "JavaScript" },
  selenium:   { label: "Selenium",   icon: "🔵", lang: "Python" },
};

function buildPrompt(description: string, framework: Framework): string {
  const meta = FRAMEWORK_META[framework];
  return `You are a senior QA automation engineer. Generate a complete, runnable ${meta.label} test file in ${meta.lang} for the following feature.

Return ONLY valid JSON (no markdown):
{
  "framework": "${framework}",
  "language": "${meta.lang}",
  "filename": "login.spec.${framework === "selenium" ? "py" : "ts"}",
  "code": "// full test file here as a single string with \\n for newlines",
  "testCount": 5,
  "notes": ["Note about selectors", "Note about base URL config"]
}

Requirements:
- Include positive tests (happy path)
- Include negative tests (invalid inputs, empty fields)
- Include at least one boundary test
- Use best-practice patterns (Page Object Model structure if applicable)
- Add descriptive test names
- Use realistic test data (not just 'foo' / 'bar')
- The code field must be a single JSON string — escape quotes and newlines properly

Feature to test:
${description}`;
}

export default function AutomationScriptGenerator() {
  const [description, setDescription] = useState("");
  const [framework, setFramework] = useState<Framework>("playwright");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const raw = await callSam(buildPrompt(description, framework));
      const parsed = parseJSON<GeneratedScript>(raw);
      setResult(parsed);
    } catch (e: any) {
      setError("Failed to generate script. Try simplifying your description.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const meta = FRAMEWORK_META[framework];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Input card */}
      <div style={CARD_STYLE}>
        <div style={{ display: "flex", gap: "16px", marginBottom: "14px" }}>
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>Feature Description</label>
            <textarea
              style={{ ...TEXTAREA_STYLE, minHeight: "90px" }}
              placeholder="Example: Login page with email and password fields, a submit button, and validation errors shown inline. Valid credentials redirect to /dashboard."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>
          <div style={{ minWidth: "160px" }}>
            <label style={LABEL_STYLE}>Framework</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {(Object.keys(FRAMEWORK_META) as Framework[]).map((fw) => {
                const m = FRAMEWORK_META[fw];
                const isActive = framework === fw;
                return (
                  <button
                    key={fw}
                    onClick={() => setFramework(fw)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "9px 14px",
                      borderRadius: "8px",
                      border: isActive
                        ? "1px solid rgba(0,245,255,0.4)"
                        : "1px solid #1e1e1e",
                      background: isActive
                        ? "rgba(0,245,255,0.07)"
                        : "rgba(255,255,255,0.02)",
                      color: isActive ? "#00f5ff" : "#666",
                      fontSize: "13px",
                      fontWeight: isActive ? 600 : 400,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{m.icon}</span>
                    <div>
                      <div style={{ fontSize: "12px" }}>{m.label}</div>
                      <div style={{ fontSize: "10px", opacity: 0.6 }}>{m.lang}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          style={loading || !description.trim() ? BUTTON_DISABLED_STYLE : BUTTON_STYLE}
          onClick={generate}
          disabled={loading || !description.trim()}
        >
          {loading ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  border: "2px solid #00f5ff44",
                  borderTop: "2px solid #00f5ff",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Generating {meta.label} script…
            </>
          ) : (
            <>
              {meta.icon} Generate {meta.label} Script
            </>
          )}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(255,85,85,0.08)",
            border: "1px solid rgba(255,85,85,0.25)",
            color: "#ff5555",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Meta bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid #1a1a1a",
            }}
          >
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#00f5ff", fontWeight: 600 }}>
                {FRAMEWORK_META[result.framework]?.icon} {result.filename}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "#555",
                  fontFamily: "var(--font-geist-mono, monospace)",
                }}
              >
                {result.testCount} tests · {result.language}
              </span>
            </div>
            <button
              onClick={copyCode}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: "1px solid #222",
                background: "rgba(255,255,255,0.03)",
                color: copied ? "#50fa7b" : "#888",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {copied ? "✓ Copied!" : "Copy Code"}
            </button>
          </div>

          {/* Code block */}
          <div style={{ position: "relative" }}>
            <div style={CODE_BLOCK}>
              {result.code}
            </div>
          </div>

          {/* Notes */}
          {result.notes && result.notes.length > 0 && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                background: "rgba(255,184,108,0.05)",
                border: "1px solid rgba(255,184,108,0.2)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#ffb86c",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-geist-mono, monospace)",
                  marginBottom: "8px",
                }}
              >
                ⚠ Implementation Notes
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {result.notes.map((note, i) => (
                  <li key={i} style={{ fontSize: "13px", color: "#ffb86c", lineHeight: 1.5 }}>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}