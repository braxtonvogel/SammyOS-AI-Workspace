"use client";

import { useState } from "react";
import {
  CARD_STYLE, LABEL_STYLE, TEXTAREA_STYLE, BUTTON_STYLE,
  BUTTON_DISABLED_STYLE, PRIORITY_COLORS,
  callSam, parseJSON,
} from "./qa-lab-utils";

interface CoverageItem {
  requirement: string;
  covered: boolean;
  coverageNote: string;
  suggestedTests: string[];
  risk: "High" | "Medium" | "Low";
}

interface CoverageReport {
  totalRequirements: number;
  coveredCount: number;
  coveragePercent: number;
  covered: CoverageItem[];
  missing: CoverageItem[];
  recommendations: string[];
}

const RISK_COLORS: Record<string, string> = {
  High:   "#ff5555",
  Medium: "#ffb86c",
  Low:    "#50fa7b",
};

const SYSTEM_PROMPT = `You are a senior QA lead analyzing test coverage gaps.

Given a list of requirements/user stories and existing test descriptions, identify what is covered and what is missing.

Return ONLY valid JSON (no markdown):
{
  "totalRequirements": 8,
  "coveredCount": 5,
  "coveragePercent": 62,
  "covered": [
    {
      "requirement": "User can log in with email and password",
      "covered": true,
      "coverageNote": "Covered by login functional tests",
      "suggestedTests": [],
      "risk": "Low"
    }
  ],
  "missing": [
    {
      "requirement": "User can reset password via email",
      "covered": false,
      "coverageNote": "No tests found for password reset flow",
      "suggestedTests": [
        "TC: Submit forgot password form with valid email",
        "TC: Submit forgot password form with unregistered email",
        "TC: Password reset link expires after 24 hours"
      ],
      "risk": "High"
    }
  ],
  "recommendations": [
    "Prioritize password reset tests — used by ~20% of users",
    "Add MFA tests before next release"
  ]
}

Risk assessment:
- High: Security, auth, data integrity, payment features
- Medium: Core user workflows, data entry
- Low: Cosmetic, optional features`;

export default function CoverageAnalyzer() {
  const [requirements, setRequirements] = useState("");
  const [existingTests, setExistingTests] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CoverageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"missing" | "covered">("missing");

  const analyze = async () => {
    if (!requirements.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const prompt = `${SYSTEM_PROMPT}

Requirements / User Stories:
${requirements}

${existingTests.trim() ? `Existing Tests:\n${existingTests}` : "No existing tests provided — assume zero coverage."}`;
      const raw = await callSam(prompt);
      const parsed = parseJSON<CoverageReport>(raw);
      setReport(parsed);
      setActiveTab("missing");
    } catch (e: any) {
      setError("Failed to analyze coverage. Make sure your requirements are clearly listed.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const coveragePct = report?.coveragePercent ?? 0;
  const coverageColor =
    coveragePct >= 80 ? "#50fa7b" : coveragePct >= 50 ? "#ffb86c" : "#ff5555";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div style={CARD_STYLE}>
          <label style={LABEL_STYLE}>Requirements / User Stories *</label>
          <textarea
            style={{ ...TEXTAREA_STYLE, minHeight: "150px" }}
            placeholder={`- User can log in with email and password
- User can reset password via email link
- User can enable two-factor authentication
- Admin can manage user roles
- Session expires after 30 minutes of inactivity`}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            disabled={loading}
          />
        </div>
        <div style={CARD_STYLE}>
          <label style={LABEL_STYLE}>Existing Test Names (optional)</label>
          <textarea
            style={{ ...TEXTAREA_STYLE, minHeight: "150px" }}
            placeholder={`TC-001: Valid login with email/password
TC-002: Invalid password shows error
TC-003: Empty fields show validation errors
TC-004: SQL injection on login form
(Leave blank to see full gap analysis)`}
            value={existingTests}
            onChange={(e) => setExistingTests(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <button
        style={loading || !requirements.trim() ? BUTTON_DISABLED_STYLE : BUTTON_STYLE}
        onClick={analyze}
        disabled={loading || !requirements.trim()}
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
            Analyzing Coverage…
          </>
        ) : (
          <>📊 Analyze Coverage</>
        )}
      </button>

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

      {/* Report */}
      {report && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Coverage meter */}
          <div
            style={{
              ...CARD_STYLE,
              display: "flex",
              alignItems: "center",
              gap: "24px",
            }}
          >
            {/* Circle */}
            <div style={{ position: "relative", width: "80px", height: "80px", flexShrink: 0 }}>
              <svg viewBox="0 0 80 80" style={{ width: "80px", height: "80px", transform: "rotate(-90deg)" }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#1a1a1a" strokeWidth="8" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke={coverageColor}
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - coveragePct / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.6s ease" }}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: 800,
                  color: coverageColor,
                  fontFamily: "var(--font-geist-mono, monospace)",
                }}
              >
                {coveragePct}%
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#e0e0e0", marginBottom: "6px" }}>
                Test Coverage Report
              </div>
              <div style={{ display: "flex", gap: "20px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#444" }}>Total Requirements</div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color: "#e0e0e0",
                      fontFamily: "var(--font-geist-mono, monospace)",
                    }}
                  >
                    {report.totalRequirements}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#444" }}>Covered</div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color: "#50fa7b",
                      fontFamily: "var(--font-geist-mono, monospace)",
                    }}
                  >
                    {report.coveredCount}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#444" }}>Missing</div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color: "#ff5555",
                      fontFamily: "var(--font-geist-mono, monospace)",
                    }}
                  >
                    {report.totalRequirements - report.coveredCount}
                  </div>
                </div>
              </div>
            </div>

            {/* Coverage bar */}
            <div style={{ width: "180px", flexShrink: 0 }}>
              <div
                style={{
                  height: "6px",
                  background: "#1a1a1a",
                  borderRadius: "3px",
                  overflow: "hidden",
                  marginBottom: "6px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${coveragePct}%`,
                    background: coverageColor,
                    borderRadius: "3px",
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
              <div style={{ fontSize: "11px", color: "#444" }}>
                {coveragePct >= 80
                  ? "✅ Good coverage"
                  : coveragePct >= 50
                  ? "⚠️ Needs improvement"
                  : "❌ Critical gaps"}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                background: "rgba(0,245,255,0.04)",
                border: "1px solid rgba(0,245,255,0.15)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "#00f5ff",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-geist-mono, monospace)",
                  marginBottom: "8px",
                }}
              >
                💡 Recommendations
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {report.recommendations.map((rec, i) => (
                  <li key={i} style={{ fontSize: "13px", color: "#8be9fd", lineHeight: 1.5 }}>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Coverage tabs */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setActiveTab("missing")}
              style={{
                padding: "7px 16px",
                borderRadius: "6px",
                border: activeTab === "missing" ? "1px solid rgba(255,85,85,0.4)" : "1px solid #1e1e1e",
                background: activeTab === "missing" ? "rgba(255,85,85,0.07)" : "rgba(255,255,255,0.02)",
                color: activeTab === "missing" ? "#ff5555" : "#555",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              ❌ Missing Coverage ({report.missing.length})
            </button>
            <button
              onClick={() => setActiveTab("covered")}
              style={{
                padding: "7px 16px",
                borderRadius: "6px",
                border: activeTab === "covered" ? "1px solid rgba(80,250,122,0.4)" : "1px solid #1e1e1e",
                background: activeTab === "covered" ? "rgba(80,250,122,0.07)" : "rgba(255,255,255,0.02)",
                color: activeTab === "covered" ? "#50fa7b" : "#555",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              ✅ Covered ({report.covered.length})
            </button>
          </div>

          {/* Items list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(activeTab === "missing" ? report.missing : report.covered).map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid #1a1a1a",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  borderLeft: `3px solid ${item.covered ? "#50fa7b" : RISK_COLORS[item.risk]}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#ddd", flex: 1, marginRight: "10px" }}>
                    {item.requirement}
                  </div>
                  {!item.covered && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        fontFamily: "var(--font-geist-mono, monospace)",
                        color: RISK_COLORS[item.risk],
                        background: `${RISK_COLORS[item.risk]}18`,
                        border: `1px solid ${RISK_COLORS[item.risk]}44`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.risk} Risk
                    </span>
                  )}
                </div>

                <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#555", lineHeight: 1.4 }}>
                  {item.coverageNote}
                </p>

                {item.suggestedTests.length > 0 && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "6px",
                      background: "rgba(139,233,253,0.04)",
                      border: "1px solid rgba(139,233,253,0.12)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#8be9fd",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontFamily: "var(--font-geist-mono, monospace)",
                        marginBottom: "6px",
                      }}
                    >
                      Suggested Tests
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "3px" }}>
                      {item.suggestedTests.map((t, i) => (
                        <li key={i} style={{ fontSize: "12px", color: "#8be9fd", lineHeight: 1.5 }}>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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