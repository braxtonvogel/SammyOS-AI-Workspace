"use client";

import { useState } from "react";
import {
  CARD_STYLE, LABEL_STYLE, TEXTAREA_STYLE, BUTTON_STYLE,
  BUTTON_DISABLED_STYLE, SECTION_HEADER, PRIORITY_COLORS,
  callSam, parseJSON,
} from "./qa-lab-utils";

interface TestCase {
  id: string;
  title: string;
  steps: string[];
  expected: string;
  priority: "P0" | "P1" | "P2";
  category: "functional" | "edge" | "regression" | "security";
}

interface TestSuite {
  functional: TestCase[];
  edge: TestCase[];
  regression: TestCase[];
  security: TestCase[];
}

const CATEGORY_LABELS: Record<string, string> = {
  functional: "Functional Tests",
  edge: "Edge Cases",
  regression: "Regression Tests",
  security: "Security Tests",
};

const CATEGORY_ICONS: Record<string, string> = {
  functional: "✅",
  edge: "⚠️",
  regression: "🔁",
  security: "🔒",
};

const SYSTEM_PROMPT = `You are a senior QA engineer. Given a UI component description, generate comprehensive test cases.

Return ONLY valid JSON in this exact shape (no markdown, no explanation):
{
  "functional": [
    {
      "id": "TC-001",
      "title": "Valid login with correct credentials",
      "steps": ["Navigate to login page", "Enter valid email", "Enter valid password", "Click Login"],
      "expected": "User is redirected to dashboard",
      "priority": "P0",
      "category": "functional"
    }
  ],
  "edge": [...],
  "regression": [...],
  "security": [...]
}

Priority rules:
- P0: Core happy path and critical security tests (app-breaking if fails)
- P1: Important negative paths and boundary conditions
- P2: Edge cases, cosmetic, nice-to-have validation

Generate at least 3 tests per category. Make steps concrete and actionable.`;

export default function TestCaseGenerator() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<keyof TestSuite>("functional");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setSuite(null);
    try {
      const prompt = `${SYSTEM_PROMPT}\n\nUI Description:\n${description}`;
      const raw = await callSam(prompt);
      const parsed = parseJSON<TestSuite>(raw);
      setSuite(parsed);
      setActiveCategory("functional");
    } catch (e: any) {
      setError("Failed to generate test cases. Try rephrasing your description.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!suite) return;
    const allTests = [
      ...suite.functional,
      ...suite.edge,
      ...suite.regression,
      ...suite.security,
    ];
    const text = allTests
      .map(
        (tc) =>
          `[${tc.priority}] ${tc.id}: ${tc.title}\nSteps:\n${tc.steps
            .map((s, i) => `  ${i + 1}. ${s}`)
            .join("\n")}\nExpected: ${tc.expected}\n`
      )
      .join("\n---\n\n");
    navigator.clipboard.writeText(text);
    setCopiedId("all");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const totalCount = suite
    ? suite.functional.length +
      suite.edge.length +
      suite.regression.length +
      suite.security.length
    : 0;

  const activeTests = suite ? suite[activeCategory] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Input card */}
      <div style={CARD_STYLE}>
        <label style={LABEL_STYLE}>Describe your UI component or feature</label>
        <textarea
          style={{ ...TEXTAREA_STYLE, minHeight: "100px" }}
          placeholder={`Example: Login page with email field, password field, remember me checkbox, forgot password link, and a submit button. Users can be admins or regular users.`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
        />
        <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center" }}>
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
                Generating…
              </>
            ) : (
              <>🧪 Generate Test Cases</>
            )}
          </button>
          {suite && (
            <span style={{ fontSize: "12px", color: "#555" }}>
              {totalCount} test cases generated
            </span>
          )}
        </div>
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

      {/* Results */}
      {suite && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Category tabs + copy button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              {(Object.keys(suite) as Array<keyof TestSuite>).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "6px",
                    border:
                      activeCategory === cat
                        ? "1px solid rgba(0,245,255,0.4)"
                        : "1px solid #1e1e1e",
                    background:
                      activeCategory === cat
                        ? "rgba(0,245,255,0.07)"
                        : "rgba(255,255,255,0.02)",
                    color: activeCategory === cat ? "#00f5ff" : "#555",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}{" "}
                  <span
                    style={{
                      marginLeft: "4px",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.06)",
                      fontSize: "10px",
                    }}
                  >
                    {suite[cat].length}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={copyAll}
              style={{
                padding: "7px 14px",
                borderRadius: "6px",
                border: "1px solid #1e1e1e",
                background: "rgba(255,255,255,0.03)",
                color: copiedId === "all" ? "#50fa7b" : "#666",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {copiedId === "all" ? "✓ Copied!" : "Copy All"}
            </button>
          </div>

          {/* Test cases list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {activeTests.map((tc) => (
              <div
                key={tc.id}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid #1a1a1a",
                  borderRadius: "10px",
                  padding: "16px",
                  borderLeft: `3px solid ${PRIORITY_COLORS[tc.priority] || "#444"}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "10px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--font-geist-mono, monospace)",
                        color: "#555",
                        marginRight: "10px",
                      }}
                    >
                      {tc.id}
                    </span>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#e0e0e0",
                      }}
                    >
                      {tc.title}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 700,
                      fontFamily: "var(--font-geist-mono, monospace)",
                      color: PRIORITY_COLORS[tc.priority],
                      background: `${PRIORITY_COLORS[tc.priority]}18`,
                      border: `1px solid ${PRIORITY_COLORS[tc.priority]}44`,
                    }}
                  >
                    {tc.priority}
                  </span>
                </div>

                <div style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#555",
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Steps
                  </div>
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    {tc.steps.map((step, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: "13px",
                          color: "#aaa",
                          lineHeight: 1.5,
                        }}
                      >
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: "rgba(80,250,122,0.05)",
                    border: "1px solid rgba(80,250,122,0.15)",
                    fontSize: "12px",
                    color: "#50fa7b",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Expected: </span>
                  {tc.expected}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}