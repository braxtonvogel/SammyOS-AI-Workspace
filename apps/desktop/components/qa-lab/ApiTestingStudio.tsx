"use client";

import { useState } from "react";
import {
  CARD_STYLE, LABEL_STYLE, TEXTAREA_STYLE, BUTTON_STYLE,
  BUTTON_DISABLED_STYLE, SELECT_STYLE, CODE_BLOCK,
  callSam, parseJSON,
} from "./qa-lab-utils";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiTest {
  name: string;
  description: string;
  method: HttpMethod;
  endpoint: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown> | null;
  expectedStatus: number;
  expectedResponse?: string;
  category: "positive" | "negative" | "boundary" | "auth";
}

interface ApiTestSuite {
  endpoint: string;
  method: HttpMethod;
  baseUrl: string;
  positive: ApiTest[];
  negative: ApiTest[];
  boundary: ApiTest[];
  auth: ApiTest[];
  postmanCollection: string;
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:    "#50fa7b",
  POST:   "#8be9fd",
  PUT:    "#ffb86c",
  PATCH:  "#f1fa8c",
  DELETE: "#ff5555",
};

const CATEGORY_LABELS = {
  positive: "✅ Positive",
  negative: "❌ Negative",
  boundary: "📐 Boundary",
  auth:     "🔐 Auth",
};

const SYSTEM_PROMPT = `You are a senior QA engineer specializing in API testing.

Given an API endpoint description, generate a comprehensive test suite.

Return ONLY valid JSON (no markdown):
{
  "endpoint": "/api/users",
  "method": "POST",
  "baseUrl": "https://api.example.com",
  "positive": [
    {
      "name": "Create user with all valid fields",
      "description": "Should return 201 and new user object",
      "method": "POST",
      "endpoint": "/api/users",
      "headers": { "Content-Type": "application/json", "Authorization": "Bearer {{token}}" },
      "body": { "email": "user@example.com", "name": "John Doe", "role": "user" },
      "expectedStatus": 201,
      "expectedResponse": "Returns user object with id, email, name, createdAt",
      "category": "positive"
    }
  ],
  "negative": [...],
  "boundary": [...],
  "auth": [...],
  "postmanCollection": "Paste-ready Postman collection JSON as a string (minified)"
}

Generate at least 2 tests per category. Cover:
- Positive: Valid request bodies, correct auth, expected status codes
- Negative: Missing required fields, wrong types, invalid values, wrong methods
- Boundary: Max-length strings, empty strings, null values, special characters
- Auth: Missing token, expired token, wrong permissions, wrong role`;

export default function ApiTestingStudio() {
  const [endpointDescription, setEndpointDescription] = useState("");
  const [method, setMethod] = useState<HttpMethod>("POST");
  const [loading, setLoading] = useState(false);
  const [suite, setSuite] = useState<ApiTestSuite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<"positive" | "negative" | "boundary" | "auth">("positive");
  const [showPostman, setShowPostman] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = async () => {
    if (!endpointDescription.trim()) return;
    setLoading(true);
    setError(null);
    setSuite(null);
    try {
      const prompt = `${SYSTEM_PROMPT}\n\nAPI Description:\n${method} ${endpointDescription}`;
      const raw = await callSam(prompt);
      const parsed = parseJSON<ApiTestSuite>(raw);
      setSuite(parsed);
      setActiveCategory("positive");
    } catch (e: any) {
      setError("Failed to generate API tests. Try providing more detail about the endpoint.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const activeTests = suite ? suite[activeCategory] : [];

  const totalCount = suite
    ? suite.positive.length + suite.negative.length + suite.boundary.length + suite.auth.length
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Input */}
      <div style={CARD_STYLE}>
        <div style={{ display: "flex", gap: "10px", marginBottom: "14px", alignItems: "flex-end" }}>
          <div>
            <label style={LABEL_STYLE}>Method</label>
            <select
              style={{ ...SELECT_STYLE, color: METHOD_COLORS[method] }}
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              disabled={loading}
            >
              {(["GET", "POST", "PUT", "PATCH", "DELETE"] as HttpMethod[]).map((m) => (
                <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>Endpoint Description</label>
            <input
              style={{
                ...SELECT_STYLE,
                width: "100%",
                boxSizing: "border-box",
              }}
              placeholder="/api/users — Creates a new user. Requires: email, name, role. Optional: avatar_url."
              value={endpointDescription}
              onChange={(e) => setEndpointDescription(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <button
          style={loading || !endpointDescription.trim() ? BUTTON_DISABLED_STYLE : BUTTON_STYLE}
          onClick={generate}
          disabled={loading || !endpointDescription.trim()}
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
              Generating API Tests…
            </>
          ) : (
            <>🔌 Generate API Test Suite</>
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

      {/* Results */}
      {suite && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Endpoint banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid #1a1a1a",
            }}
          >
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "4px",
                background: `${METHOD_COLORS[suite.method]}18`,
                border: `1px solid ${METHOD_COLORS[suite.method]}44`,
                color: METHOD_COLORS[suite.method],
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              {suite.method}
            </span>
            <span
              style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: "13px",
                color: "#aaa",
              }}
            >
              {suite.baseUrl}{suite.endpoint}
            </span>
            <span style={{ marginLeft: "auto", fontSize: "12px", color: "#444" }}>
              {totalCount} tests
            </span>
          </div>

          {/* Category tabs */}
          <div style={{ display: "flex", gap: "6px", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => {
                const isActive = activeCategory === cat;
                const count = suite[cat].length;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "6px",
                      border: isActive ? "1px solid rgba(0,245,255,0.4)" : "1px solid #1e1e1e",
                      background: isActive ? "rgba(0,245,255,0.07)" : "rgba(255,255,255,0.02)",
                      color: isActive ? "#00f5ff" : "#555",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {CATEGORY_LABELS[cat]}{" "}
                    <span
                      style={{
                        marginLeft: "4px",
                        padding: "1px 5px",
                        borderRadius: "8px",
                        background: "rgba(255,255,255,0.06)",
                        fontSize: "10px",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowPostman(!showPostman)}
              style={{
                padding: "7px 14px",
                borderRadius: "6px",
                border: "1px solid #222",
                background: showPostman ? "rgba(255,184,108,0.08)" : "rgba(255,255,255,0.02)",
                color: showPostman ? "#ffb86c" : "#555",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              📮 Postman Collection
            </button>
          </div>

          {/* Postman collection */}
          {showPostman && suite.postmanCollection && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => copy(suite.postmanCollection, "postman")}
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  padding: "5px 12px",
                  borderRadius: "5px",
                  border: "1px solid #333",
                  background: "rgba(255,255,255,0.05)",
                  color: copied === "postman" ? "#50fa7b" : "#888",
                  fontSize: "11px",
                  cursor: "pointer",
                  zIndex: 1,
                }}
              >
                {copied === "postman" ? "✓" : "Copy"}
              </button>
              <div style={{ ...CODE_BLOCK, maxHeight: "200px", overflowY: "auto" }}>
                {suite.postmanCollection}
              </div>
            </div>
          )}

          {/* Test cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {activeTests.map((test, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid #1a1a1a",
                  borderRadius: "10px",
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <span
                      style={{
                        padding: "2px 7px",
                        borderRadius: "3px",
                        background: `${METHOD_COLORS[test.method] || "#888"}18`,
                        color: METHOD_COLORS[test.method] || "#888",
                        fontSize: "10px",
                        fontFamily: "var(--font-geist-mono, monospace)",
                        fontWeight: 700,
                        marginRight: "8px",
                      }}
                    >
                      {test.method}
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#ddd" }}>{test.name}</span>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-geist-mono, monospace)",
                      fontSize: "12px",
                      color:
                        test.expectedStatus < 300
                          ? "#50fa7b"
                          : test.expectedStatus < 400
                          ? "#ffb86c"
                          : "#ff5555",
                      fontWeight: 700,
                    }}
                  >
                    {test.expectedStatus}
                  </span>
                </div>

                <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#666", lineHeight: 1.4 }}>
                  {test.description}
                </p>

                {test.body && (
                  <div style={{ ...CODE_BLOCK, marginTop: "6px", fontSize: "11px" }}>
                    {JSON.stringify(test.body, null, 2)}
                  </div>
                )}

                {test.expectedResponse && (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "6px 10px",
                      borderRadius: "5px",
                      background: "rgba(139,233,253,0.05)",
                      border: "1px solid rgba(139,233,253,0.15)",
                      fontSize: "12px",
                      color: "#8be9fd",
                    }}
                  >
                    Response: {test.expectedResponse}
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