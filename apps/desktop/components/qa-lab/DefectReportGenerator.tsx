"use client";

import { useState } from "react";
import {
  CARD_STYLE, LABEL_STYLE, TEXTAREA_STYLE, BUTTON_STYLE,
  BUTTON_DISABLED_STYLE, SEVERITY_COLORS, PRIORITY_COLORS,
  callSam, parseJSON,
} from "./qa-lab-utils";

interface BugReport {
  title: string;
  summary: string;
  steps: string[];
  expected: string;
  actual: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  priority: "P0" | "P1" | "P2" | "P3";
  environment: string;
  labels: string[];
  reproducibility: "Always" | "Sometimes" | "Rarely" | "Once";
  suggestedAssignee: string;
}

const SYSTEM_PROMPT = `You are a senior QA engineer writing professional defect reports.

Given a raw bug description, produce a structured, professional bug report.

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Short, clear title in imperative form (max 80 chars)",
  "summary": "One paragraph technical description of the issue",
  "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "expected": "What should happen",
  "actual": "What actually happens (the bug)",
  "severity": "Critical | High | Medium | Low",
  "priority": "P0 | P1 | P2 | P3",
  "environment": "Web App / Staging / Chrome 124 / macOS (infer from context or use reasonable defaults)",
  "labels": ["bug", "regression", "ui", ...],
  "reproducibility": "Always | Sometimes | Rarely | Once",
  "suggestedAssignee": "Frontend Team | Backend Team | QA Team | DevOps (based on context)"
}

Severity guide:
- Critical: Data loss, security breach, crash affecting all users
- High: Major feature broken, significant user impact
- Medium: Feature partially broken, workaround exists
- Low: Cosmetic, minor UX issue`;

export default function DefectReportGenerator() {
  const [rawDescription, setRawDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<BugReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!rawDescription.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const prompt = `${SYSTEM_PROMPT}\n\nRaw bug description:\n${rawDescription}`;
      const raw = await callSam(prompt);
      const parsed = parseJSON<BugReport>(raw);
      setReport(parsed);
    } catch (e: any) {
      setError("Failed to generate bug report. Try adding more details to your description.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copyReport = () => {
    if (!report) return;
    const text = `# Bug Report: ${report.title}

**Severity:** ${report.severity}  **Priority:** ${report.priority}  **Reproducibility:** ${report.reproducibility}

## Summary
${report.summary}

## Steps to Reproduce
${report.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Expected Behavior
${report.expected}

## Actual Behavior
${report.actual}

## Environment
${report.environment}

## Labels
${report.labels.join(", ")}

## Suggested Assignee
${report.suggestedAssignee}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Input */}
      <div style={CARD_STYLE}>
        <label style={LABEL_STYLE}>Paste raw bug description</label>
        <textarea
          style={{ ...TEXTAREA_STYLE, minHeight: "110px" }}
          placeholder={`Example: app crashes when pressing save button after deleting profile picture. happens every time. found on staging server.`}
          value={rawDescription}
          onChange={(e) => setRawDescription(e.target.value)}
          disabled={loading}
        />
        <div style={{ marginTop: "12px" }}>
          <button
            style={loading || !rawDescription.trim() ? BUTTON_DISABLED_STYLE : BUTTON_STYLE}
            onClick={generate}
            disabled={loading || !rawDescription.trim()}
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
                Generating Report…
              </>
            ) : (
              <>🐛 Generate Defect Report</>
            )}
          </button>
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

      {/* Report output */}
      {report && (
        <div
          style={{
            ...CARD_STYLE,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "#555",
                  fontFamily: "var(--font-geist-mono, monospace)",
                  marginBottom: "4px",
                  letterSpacing: "0.08em",
                }}
              >
                DEFECT REPORT
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#e0e0e0", lineHeight: 1.3 }}>
                {report.title}
              </div>
            </div>
            <button
              onClick={copyReport}
              style={{
                padding: "7px 14px",
                borderRadius: "6px",
                border: "1px solid #222",
                background: "rgba(255,255,255,0.03)",
                color: copied ? "#50fa7b" : "#666",
                fontSize: "12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                marginLeft: "16px",
              }}
            >
              {copied ? "✓ Copied!" : "Copy Markdown"}
            </button>
          </div>

          {/* Badges row */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { label: report.severity, color: SEVERITY_COLORS[report.severity] || "#888", prefix: "Severity" },
              { label: report.priority, color: PRIORITY_COLORS[report.priority] || "#888", prefix: "Priority" },
              { label: report.reproducibility, color: "#8be9fd", prefix: "Repro" },
            ].map((badge) => (
              <div
                key={badge.prefix}
                style={{
                  padding: "4px 10px",
                  borderRadius: "5px",
                  background: `${badge.color}14`,
                  border: `1px solid ${badge.color}40`,
                  fontSize: "12px",
                  fontFamily: "var(--font-geist-mono, monospace)",
                }}
              >
                <span style={{ color: "#555" }}>{badge.prefix}: </span>
                <span style={{ color: badge.color, fontWeight: 700 }}>{badge.label}</span>
              </div>
            ))}
            {report.labels.map((label) => (
              <div
                key={label}
                style={{
                  padding: "4px 10px",
                  borderRadius: "5px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid #222",
                  fontSize: "11px",
                  color: "#666",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Summary */}
          <Section title="Summary">
            <p style={{ margin: 0, fontSize: "13px", color: "#aaa", lineHeight: 1.6 }}>
              {report.summary}
            </p>
          </Section>

          {/* Steps */}
          <Section title="Steps to Reproduce">
            <ol style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {report.steps.map((step, i) => (
                <li key={i} style={{ fontSize: "13px", color: "#aaa", lineHeight: 1.5 }}>
                  {step}
                </li>
              ))}
            </ol>
          </Section>

          {/* Expected vs Actual */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                background: "rgba(80,250,122,0.05)",
                border: "1px solid rgba(80,250,122,0.15)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "#50fa7b",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                  fontFamily: "var(--font-geist-mono, monospace)",
                }}
              >
                Expected
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#aaa", lineHeight: 1.5 }}>
                {report.expected}
              </p>
            </div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                background: "rgba(255,85,85,0.05)",
                border: "1px solid rgba(255,85,85,0.15)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "#ff5555",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                  fontFamily: "var(--font-geist-mono, monospace)",
                }}
              >
                Actual (Bug)
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#aaa", lineHeight: 1.5 }}>
                {report.actual}
              </p>
            </div>
          </div>

          {/* Meta */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              padding: "12px 14px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid #1a1a1a",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", color: "#444", marginBottom: "3px" }}>Environment</div>
              <div style={{ fontSize: "13px", color: "#888" }}>{report.environment}</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "#444", marginBottom: "3px" }}>Suggested Assignee</div>
              <div style={{ fontSize: "13px", color: "#888" }}>{report.suggestedAssignee}</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "#555",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: "var(--font-geist-mono, monospace)",
          marginBottom: "8px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}