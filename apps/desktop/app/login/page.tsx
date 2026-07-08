// app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, loading, error, clearError, user } = useAuthStore();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const [groqKey, setGroqKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [cerebrasKey, setCerebrasKey] = useState("");
  const [braveKey, setBraveKey] = useState("");

  const [localError, setLocalError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // NEW — controls the legal document modal. null = closed.
  const [legalModal, setLegalModal] = useState<null | "terms" | "privacy">(null);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    clearError();
    setLocalError("");
    setAgreedToTerms(false);
  }, [mode, clearError]);

  // NEW — close modal on Escape key
  useEffect(() => {
    if (!legalModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLegalModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [legalModal]);

  const displayError = localError || error;

  const handleLoginSubmit = async () => {
    if (!email || !password) { setLocalError("Please fill in all fields"); return; }
    const ok = await login(email, password);
    if (ok) router.replace("/");
  };

  const handleSignupStep1 = () => {
    if (!email || !password) { setLocalError("Please fill in all fields"); return; }
    if (password !== confirmPassword) { setLocalError("Passwords do not match"); return; }
    if (password.length < 8) { setLocalError("Password must be at least 8 characters"); return; }
    if (!agreedToTerms) { setLocalError("You must agree to the Terms of Service to create an account"); return; }
    setLocalError("");
    setStep(2);
  };

  const handleSignupSubmit = async () => {
    if (!groqKey && !geminiKey && !cerebrasKey) {
      setLocalError("At least one AI API key is required (Groq is free and recommended)");
      return;
    }
    const apiKeys: Record<string, string> = {};
    if (groqKey) apiKeys.GROQ_API_KEY = groqKey.trim();
    if (geminiKey) apiKeys.GEMINI_API_KEY = geminiKey.trim();
    if (cerebrasKey) apiKeys.CEREBRAS_API_KEY = cerebrasKey.trim();
    if (braveKey) apiKeys.BRAVE_API_KEY = braveKey.trim();

    const ok = await register(email, password, apiKeys);
    if (ok) router.replace("/");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0d0d0f",
    border: "1px solid #2a2a2e",
    borderRadius: 8,
    color: "#e0e0e0",
    fontSize: 14,
    padding: "11px 14px",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    color: "#888",
    marginBottom: 6,
    fontWeight: 500,
    letterSpacing: "0.03em",
  };

  const primaryBtn: React.CSSProperties = {
    width: "100%",
    background: loading ? "#1e1e22" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    borderRadius: 8,
    color: loading ? "#555" : "#fff",
    fontSize: 14,
    fontWeight: 600,
    padding: "12px",
    cursor: loading ? "not-allowed" : "pointer",
    letterSpacing: "0.02em",
    transition: "opacity 0.2s",
    opacity: loading ? 0.6 : 1,
  };

  const linkStyle: React.CSSProperties = {
    color: "#6366f1",
    textDecoration: "underline",
    textDecorationColor: "rgba(99,102,241,0.4)",
    cursor: "pointer",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080809",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "24px 16px",
    }}>
      {/* Subtle grid bg */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>

        {/* Logo / wordmark */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            fontSize: 22, marginBottom: 14,
            boxShadow: "0 0 32px rgba(99,102,241,0.35)",
          }}>
            S
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#e0e0e0", letterSpacing: "-0.02em" }}>
            Sammy OS
          </div>
          <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
            AI-Powered Desktop Workspace
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "#111114",
          border: "1px solid #1e1e22",
          borderRadius: 16,
          padding: "28px 28px 24px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}>
          {/* Mode tabs */}
          <div style={{ display: "flex", marginBottom: 24, background: "#0d0d0f", borderRadius: 8, padding: 3, gap: 2 }}>
            {(["login", "signup"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setStep(1); }}
                style={{
                  flex: 1, padding: "8px", borderRadius: 6, border: "none",
                  background: mode === m ? "#1e1e2e" : "transparent",
                  color: mode === m ? "#a5b4fc" : "#555",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.15s",
                  boxShadow: mode === m ? "0 0 0 1px #4a4a8f" : "none",
                }}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Error */}
          {displayError && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 8, padding: "10px 12px", marginBottom: 18,
              fontSize: 13, color: "#f87171",
            }}>
              {displayError}
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === "login" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLoginSubmit()} />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input style={inputStyle} type="password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLoginSubmit()} />
              </div>
              <button style={primaryBtn} onClick={handleLoginSubmit} disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </div>
          )}

          {/* ── SIGNUP STEP 1: Credentials ── */}
          {mode === "signup" && step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input style={inputStyle} type="password" placeholder="Min 8 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input style={inputStyle} type="password" placeholder="Repeat password"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignupStep1()} />
              </div>

              {/* ── TERMS OF SERVICE CHECKBOX ── */}
              <label style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                cursor: "pointer", userSelect: "none",
              }}>
                <div style={{ position: "relative", flexShrink: 0, marginTop: 1 }}>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer", margin: 0 }}
                  />
                  <div style={{
                    width: 16, height: 16, borderRadius: 4,
                    border: agreedToTerms ? "1.5px solid #6366f1" : "1.5px solid #2a2a2e",
                    background: agreedToTerms ? "rgba(99,102,241,0.2)" : "#0d0d0f",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {agreedToTerms && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                  I agree to the{" "}
                  {/* FIXED — was <a target="_blank">, now opens in-app modal */}
                  <span
                    style={linkStyle}
                    onClick={(e) => { e.stopPropagation(); setLegalModal("terms"); }}
                  >
                    Terms of Service
                  </span>
                  {" "}and{" "}
                  {/* FIXED — was <a target="_blank">, now opens in-app modal */}
                  <span
                    style={linkStyle}
                    onClick={(e) => { e.stopPropagation(); setLegalModal("privacy"); }}
                  >
                    Privacy Policy
                  </span>
                  . I understand this is a portfolio project provided as-is with no warranty.
                </span>
              </label>

              <button
                style={{
                  ...primaryBtn,
                  opacity: (!agreedToTerms || loading) ? 0.4 : 1,
                  cursor: !agreedToTerms ? "not-allowed" : "pointer",
                }}
                onClick={handleSignupStep1}
                disabled={!agreedToTerms || loading}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── SIGNUP STEP 2: API Keys ── */}
          {mode === "signup" && step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{
                background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)",
                borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#a5b4fc",
                lineHeight: 1.6,
              }}>
                Your API keys are encrypted and stored securely. They are only used to power Sam on your machine.
              </div>

              <div>
                <label style={labelStyle}>
                  Groq API Key{" "}
                  <span style={{ color: "#6366f1" }}>★ Recommended (free)</span>
                </label>
                <input style={inputStyle} type="password" placeholder="gsk_..."
                  value={groqKey} onChange={(e) => setGroqKey(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Gemini API Key <span style={{ color: "#555" }}>(optional)</span></label>
                <input style={inputStyle} type="password" placeholder="AIza..."
                  value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Cerebras API Key <span style={{ color: "#555" }}>(optional)</span></label>
                <input style={inputStyle} type="password" placeholder="csk_..."
                  value={cerebrasKey} onChange={(e) => setCerebrasKey(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Brave Search Key <span style={{ color: "#555" }}>(optional — enables better web search)</span></label>
                <input style={inputStyle} type="password" placeholder="BSA..."
                  value={braveKey} onChange={(e) => setBraveKey(e.target.value)} />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => { setStep(1); setLocalError(""); }}
                  style={{ ...primaryBtn, background: "#1a1a1f", border: "1px solid #2a2a2e", color: "#888", flex: "0 0 80px", width: "auto" }}>
                  ← Back
                </button>
                <button style={{ ...primaryBtn, flex: 1, width: "auto" }}
                  onClick={handleSignupSubmit} disabled={loading}>
                  {loading ? "Creating account…" : "Create Account"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#333" }}>
          <div style={{ marginBottom: 6 }}>
            {/* FIXED — was <a target="_blank">, now opens in-app modal */}
            <span
              onClick={() => setLegalModal("terms")}
              style={{ color: "#444", textDecoration: "none", marginRight: 16, cursor: "pointer" }}
            >
              Terms of Service
            </span>
            {/* FIXED — was <a target="_blank">, now opens in-app modal */}
            <span
              onClick={() => setLegalModal("privacy")}
              style={{ color: "#444", textDecoration: "none", cursor: "pointer" }}
            >
              Privacy Policy
            </span>
          </div>
          <div>
            Built by{" "}
            <a href="https://braxtonvogel.com" target="_blank" rel="noreferrer"
              style={{ color: "#6366f1", textDecoration: "none" }}>
              Braxton Vogel
            </a>
          </div>
        </div>

      </div>

      {/* ── LEGAL DOCUMENT MODAL ── */}
      {legalModal && (
        <div
          onClick={() => setLegalModal(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%", maxWidth: 720, height: "80vh",
              background: "#111114",
              border: "1px solid #2a2a2e",
              borderRadius: 14,
              overflow: "hidden",
              display: "flex", flexDirection: "column",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header bar with title + close button */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px",
              borderBottom: "1px solid #1e1e22",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>
                {legalModal === "terms" ? "Terms of Service" : "Privacy Policy"}
              </span>
              <button
                onClick={() => setLegalModal(null)}
                aria-label="Close"
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: "#1a1a1f", border: "1px solid #2a2a2e",
                  color: "#999", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <iframe
              src={
                legalModal === "terms"
                  ? "https://braxtonvogel.com/sammyos-terms.html"
                  : "https://braxtonvogel.com/sammyos-privacy.html"
              }
              style={{ flex: 1, border: "none", width: "100%", height: "100%", background: "#fff" }}
              title={legalModal === "terms" ? "Terms of Service" : "Privacy Policy"}
            />
          </div>
        </div>
      )}
    </div>
  );
}