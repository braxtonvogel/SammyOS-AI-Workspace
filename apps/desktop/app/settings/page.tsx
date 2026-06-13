"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useRouter } from "next/navigation";

interface VaultFile {
  id: string; name: string; type: string; size: number; preview: string; uploadedAt: string;
}

interface ResearchJob {
  id: string; topic: string; status: string; result?: string; completedAt?: number; createdAt: number; savedToVault?: boolean;
}

interface OllamaModel { name: string; size: number; modified_at: string; }

// ─── File Viewer Modal ────────────────────────────────────────────────────────
function FileViewer({ title, content, onClose }: { title: string; content: string; onClose: () => void; }) {
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const highlighted = search.trim()
    ? content.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"))
    : [content];

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const isCode = !title.endsWith(".md") && !title.startsWith("Research:") && /\.(ts|tsx|js|jsx|py|java|go|rs|cs|json)$/.test(title);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "860px", height: "82vh", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: "14px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderBottom: "1px solid #1a1a1a", background: "#0f0f0f", flexShrink: 0 }}>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#e8e8e8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
            <div style={{ fontSize: "10px", color: "#555", marginTop: "1px" }}>{(content.length / 1024).toFixed(1)} KB · Press Esc to close</div>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", color: "#e0e0e0", padding: "5px 11px", fontSize: "12px", outline: "none", width: "160px", fontFamily: "inherit" }} />
          <button onClick={handleCopy} style={{ background: copied ? "rgba(74,170,120,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${copied ? "rgba(74,170,120,0.35)" : "#2a2a2a"}`, borderRadius: "6px", color: copied ? "#4aaa78" : "#888", padding: "5px 12px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>
            {copied ? "✓ Copied" : "Copy all"}
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "18px", padding: "4px 8px" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", fontFamily: isCode ? "monospace" : "system-ui, -apple-system, sans-serif", fontSize: isCode ? "12.5px" : "13.5px", lineHeight: isCode ? "1.65" : "1.75", color: "#c8c8c8", whiteSpace: isCode ? "pre" : "pre-wrap", wordBreak: "break-word" }}>
          {search.trim()
            ? highlighted.map((part, i) => i % 2 === 1 ? <mark key={i} style={{ background: "rgba(255,200,80,0.28)", color: "#ffe066", borderRadius: "2px", padding: "0 1px" }}>{part}</mark> : part)
            : content}
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode; }) {
  return (
    <div style={{ marginBottom: "32px" }}>
      <div style={{ marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid #161616" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#e8e8e8" }}>{title}</div>
        {subtitle && <div style={{ fontSize: "11px", color: "#555", marginTop: "3px" }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, value, onChange, accent = "#60b8ff" }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void; accent?: string; }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "10px", marginBottom: "8px" }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#e0e0e0" }}>{label}</div>
        {description && <div style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>{description}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        style={{ width: "44px", height: "24px", borderRadius: "999px", background: value ? accent : "#222", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: "3px", left: value ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
      </button>
    </div>
  );
}

function FileRow({ icon, name, meta, onView, onDelete }: { icon: string; name: string; meta: string; onView: () => void; onDelete?: () => void; }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: hov ? "rgba(255,255,255,0.025)" : "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "8px", marginBottom: "6px", transition: "background 0.15s" }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <span style={{ fontSize: "15px", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#ddd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: "10px", color: "#555", marginTop: "1px" }}>{meta}</div>
      </div>
      <button onClick={onView}
        style={{ background: "rgba(96,184,255,0.08)", border: "1px solid rgba(96,184,255,0.2)", borderRadius: "5px", color: "#60b8ff", padding: "4px 12px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
        View
      </button>
      {onDelete && (
        <button onClick={onDelete}
          style={{ background: "none", border: "none", color: "#444", cursor: "pointer", padding: "4px 6px", borderRadius: "4px", fontSize: "13px", transition: "color 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#e55")} onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}>
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Preset configs for the "how to" guide ────────────────────────────────────
const API_PRESETS: Record<string, { url: string; label: string; keyName: string; keyLink: string; keyHint: string }> = {
  openai: {
    label: "OpenAI (ChatGPT)",
    url: "https://api.openai.com/v1",
    keyName: "OpenAI API Key",
    keyLink: "https://platform.openai.com/api-keys",
    keyHint: "Starts with sk-...",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    url: "https://api.anthropic.com/v1",
    keyName: "Anthropic API Key",
    keyLink: "https://console.anthropic.com/settings/keys",
    keyHint: "Starts with sk-ant-...",
  },
  groq: {
    label: "Groq (free tier)",
    url: "https://api.groq.com/openai/v1",
    keyName: "Groq API Key",
    keyLink: "https://console.groq.com/keys",
    keyHint: "Starts with gsk_...",
  },
  custom: {
    label: "Custom / Other",
    url: "",
    keyName: "API Key",
    keyLink: "",
    keyHint: "Your API key",
  },
};

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  // ── Auth — MUST be inside component body ──────────────────────────────────
  const { logout, user } = useAuthStore();
  const router = useRouter();

  // ── AI Provider state ─────────────────────────────────────────────────────
  const [useOllama, setUseOllama] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("llama3.1");
  const [ollamaStatus, setOllamaStatus] = useState<"unchecked" | "ok" | "error">("unchecked");
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerSaved, setProviderSaved] = useState(false);

  // ── Custom API key state ───────────────────────────────────────────────────
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof API_PRESETS>("openai");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customApiUrl, setCustomApiUrl] = useState(API_PRESETS.openai.url);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingCustomKey, setSavingCustomKey] = useState(false);
  const [customKeySaved, setCustomKeySaved] = useState(false);
  const [customKeySaveError, setCustomKeySaveError] = useState("");
  const [clearingCustomKey, setClearingCustomKey] = useState(false);
  const [existingCustomKey, setExistingCustomKey] = useState(false); // whether server has one saved

  // ── Vault / Research state ────────────────────────────────────────────────
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [vaultSearch, setVaultSearch] = useState("");
  const [researchJobs, setResearchJobs] = useState<ResearchJob[]>([]);
  const [researchSearch, setResearchSearch] = useState("");

  // ── Viewer state ──────────────────────────────────────────────────────────
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerContent, setViewerContent] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [loadingView, setLoadingView] = useState(false);

  useEffect(() => {
    fetch("/api/settings/provider").then((r) => r.json()).then((d) => {
      setUseOllama(d.useOllama ?? false);
      setOllamaUrl(d.ollamaUrl ?? "http://localhost:11434");
      setSelectedModel(d.model ?? "llama3.1");
    }).catch(() => {});

    fetch("/api/vault/list").then((r) => r.json()).then((d) => setVaultFiles(d.files ?? [])).catch(() => {});

    fetch("/api/research/list").then((r) => r.json()).then((d) =>
      setResearchJobs((d.jobs ?? []).filter((j: ResearchJob) => j.status === "complete"))
    ).catch(() => {});

    // Check whether user already has a custom key saved
    if (user?.token) {
      fetch(`${process.env.NEXT_PUBLIC_NEXUS_ANALYZER_URL}/api/auth/keys`, {
        headers: { "x-sammy-token": user.token },
      }).then((r) => r.json()).then((d) => {
        if (d.keys?.CUSTOM_API_KEY) {
          setExistingCustomKey(true);
          setCustomApiUrl(d.keys.CUSTOM_API_URL ?? "");
        }
      }).catch(() => {});
    }
  }, [user]);

  const checkOllama = async () => {
    setCheckingOllama(true);
    setOllamaStatus("unchecked");
    try {
      const res = await fetch("/api/settings/ollama-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: ollamaUrl }) });
      const data = await res.json();
      if (data.ok) { setOllamaStatus("ok"); setOllamaModels(data.models ?? []); if (data.models?.length > 0) setSelectedModel(data.models[0].name); }
      else setOllamaStatus("error");
    } catch { setOllamaStatus("error"); }
    finally { setCheckingOllama(false); }
  };

  const saveProvider = async () => {
    setSavingProvider(true);
    try {
      await fetch("/api/settings/provider", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ useOllama, ollamaUrl, model: selectedModel }) });
      setProviderSaved(true);
      setTimeout(() => setProviderSaved(false), 2500);
    } catch {}
    setSavingProvider(false);
  };

  const handlePresetChange = (preset: keyof typeof API_PRESETS) => {
    setSelectedPreset(preset);
    setCustomApiUrl(API_PRESETS[preset].url);
    setCustomKeySaved(false);
    setCustomKeySaveError("");
  };

  const saveCustomKey = async () => {
    if (!customApiKey.trim()) return;
    if (!user?.token) { setCustomKeySaveError("You must be logged in to save a key."); return; }
    setSavingCustomKey(true);
    setCustomKeySaveError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_NEXUS_ANALYZER_URL}/api/auth/keys`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-sammy-token": user.token },
        body: JSON.stringify({ CUSTOM_API_KEY: customApiKey.trim(), CUSTOM_API_URL: customApiUrl.trim() }),
      });
      if (!res.ok) throw new Error("Save failed");
      setCustomKeySaved(true);
      setExistingCustomKey(true);
      setCustomApiKey(""); // clear field after save for security
      setTimeout(() => setCustomKeySaved(false), 3000);
    } catch {
      setCustomKeySaveError("Could not save — check your connection.");
    }
    setSavingCustomKey(false);
  };

  const clearCustomKey = async () => {
    if (!user?.token) return;
    setClearingCustomKey(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_NEXUS_ANALYZER_URL}/api/auth/keys`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-sammy-token": user.token },
        body: JSON.stringify({ CUSTOM_API_KEY: "", CUSTOM_API_URL: "" }),
      });
      setExistingCustomKey(false);
      setCustomApiKey("");
      setCustomApiUrl(API_PRESETS[selectedPreset].url);
    } catch {}
    setClearingCustomKey(false);
  };

  const openVaultFile = async (file: VaultFile) => {
    setLoadingView(true);
    try {
      const res = await fetch(`/api/vault/content?id=${file.id}`);
      const data = await res.json();
      setViewerTitle(file.name);
      setViewerContent(data.content ?? "(no content)");
      setViewerOpen(true);
    } catch { setViewerTitle(file.name); setViewerContent("(failed to load)"); setViewerOpen(true); }
    finally { setLoadingView(false); }
  };

  const openResearch = (job: ResearchJob) => {
    setViewerTitle(`Research: ${job.topic}`);
    setViewerContent(job.result ?? "(no content)");
    setViewerOpen(true);
  };

  const deleteResearch = async (id: string) => {
    await fetch(`/api/research/delete?jobId=${id}`, { method: "DELETE" }).catch(() => {});
    setResearchJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const deleteVault = async (id: string) => {
    await fetch(`/api/vault/delete?id=${id}`, { method: "DELETE" }).catch(() => {});
    setVaultFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const filteredVault = vaultFiles.filter((f) => !vaultSearch || f.name.toLowerCase().includes(vaultSearch.toLowerCase()));
  const filteredResearch = researchJobs.filter((j) => !researchSearch || j.topic.toLowerCase().includes(researchSearch.toLowerCase()));

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileIcon = (name: string, type: string) => {
    if (name.endsWith("CODEBASE_SUMMARY.md")) return "🗂️";
    if (name.endsWith("CODE_EXAMPLES.md")) return "💻";
    if (name.startsWith("Research:")) return "🔬";
    if (name.endsWith(".md")) return "📄";
    if (type?.includes("pdf")) return "📕";
    if (name.match(/\.(ts|tsx|js|jsx|py|java|go|rs)$/)) return "⚡";
    return "📝";
  };

  const preset = API_PRESETS[selectedPreset];

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#080808", color: "#e0e0e0", fontFamily: "system-ui, -apple-system, sans-serif", padding: "24px 28px" }}>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "11px", letterSpacing: "0.14em", color: "#444", marginBottom: "2px" }}>Sammy OS</div>
        <div style={{ fontSize: "22px", fontWeight: 700, color: "#e8e8e8" }}>Settings</div>
      </div>

      {/* ── 1. AI PROVIDER ────────────────────────────────────────────────── */}
      <Section title="AI Provider" subtitle="Choose between the built-in free API rotation or a local Ollama instance.">
        <ToggleRow label="Use Ollama (Local AI)" description="Runs entirely on your hardware — no token limits, no internet required for AI calls." value={useOllama} onChange={setUseOllama} accent="#60b8ff" />

        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", marginBottom: "12px", background: useOllama ? "rgba(96,184,255,0.06)" : "rgba(74,170,120,0.06)", border: `1px solid ${useOllama ? "rgba(96,184,255,0.15)" : "rgba(74,170,120,0.15)"}`, borderRadius: "8px", fontSize: "12px" }}>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: useOllama ? "#60b8ff" : "#4aaa78", boxShadow: `0 0 6px ${useOllama ? "#60b8ff" : "#4aaa78"}` }} />
          <span style={{ color: useOllama ? "#60b8ff" : "#4aaa78", fontWeight: 600 }}>{useOllama ? "Ollama (local)" : "Free API rotation"}</span>
          <span style={{ color: "#555" }}>{useOllama ? "— AI runs on your hardware with no token limits" : "— Groq → Gemini → Cerebras"}</span>
        </div>

        {useOllama && (
          <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>
            <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "6px" }}>OLLAMA URL</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "7px", color: "#e0e0e0", padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "monospace" }} />
              <button onClick={checkOllama} disabled={checkingOllama} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid #2a2a2a", borderRadius: "7px", color: "#ccc", padding: "8px 16px", cursor: checkingOllama ? "not-allowed" : "pointer", fontSize: "12px", fontFamily: "inherit" }}>
                {checkingOllama ? "Checking…" : "Test Connection"}
              </button>
            </div>
            {ollamaStatus === "ok" && <div style={{ fontSize: "11px", color: "#4aaa78", marginBottom: "12px" }}>✓ Connected — {ollamaModels.length} model{ollamaModels.length !== 1 ? "s" : ""} available</div>}
            {ollamaStatus === "error" && <div style={{ fontSize: "11px", color: "#e55", marginBottom: "12px" }}>✕ Could not connect — run <code>ollama serve</code></div>}

            <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "6px" }}>MODEL</label>
            {ollamaModels.length > 0 ? (
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "7px", color: "#e0e0e0", padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }}>
                {ollamaModels.map((m) => <option key={m.name} value={m.name} style={{ background: "#1a1a1a" }}>{m.name} ({(m.size / 1e9).toFixed(1)} GB)</option>)}
              </select>
            ) : (
              <input value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} placeholder="e.g. llama3.1, mistral, codellama" style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "7px", color: "#e0e0e0", padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            )}
          </div>
        )}

        <button onClick={saveProvider} disabled={savingProvider}
          style={{ background: providerSaved ? "rgba(74,170,120,0.15)" : "rgba(96,184,255,0.12)", border: `1px solid ${providerSaved ? "rgba(74,170,120,0.35)" : "rgba(96,184,255,0.3)"}`, borderRadius: "8px", color: providerSaved ? "#4aaa78" : "#60b8ff", padding: "9px 20px", cursor: "pointer", fontSize: "13px", fontFamily: "inherit", fontWeight: 600 }}>
          {providerSaved ? "✓ Saved" : savingProvider ? "Saving…" : "Save Provider Settings"}
        </button>
      </Section>

      {/* ── 2. YOUR OWN API KEY (NEW) ──────────────────────────────────────── */}
      <Section
        title="Your Own API Key"
        subtitle="Use your own paid API key for the best experience. Sam will try it first and automatically fall back to the free rotation if it fails or runs out."
      >
        {/* Status badge — shows when a key is already saved */}
        {existingCustomKey && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(74,170,120,0.07)", border: "1px solid rgba(74,170,120,0.2)", borderRadius: "8px", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#4aaa78", boxShadow: "0 0 6px #4aaa78" }} />
              <span style={{ fontSize: "12px", color: "#4aaa78", fontWeight: 600 }}>Custom key active</span>
              <span style={{ fontSize: "11px", color: "#555" }}>— Sam will try your key first</span>
            </div>
            <button onClick={clearCustomKey} disabled={clearingCustomKey}
              style={{ background: "none", border: "1px solid #3a2020", borderRadius: "6px", color: "#a55", padding: "4px 10px", fontSize: "11px", cursor: clearingCustomKey ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {clearingCustomKey ? "Removing…" : "Remove key"}
            </button>
          </div>
        )}

        {/* Provider picker */}
        <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "6px" }}>PROVIDER</label>
        <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
          {(Object.keys(API_PRESETS) as Array<keyof typeof API_PRESETS>).map((key) => (
            <button key={key} onClick={() => handlePresetChange(key)}
              style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", background: selectedPreset === key ? "rgba(99,102,241,0.15)" : "#0f0f0f", border: `1px solid ${selectedPreset === key ? "rgba(99,102,241,0.5)" : "#1e1e1e"}`, color: selectedPreset === key ? "#a5b4fc" : "#666", fontWeight: selectedPreset === key ? 600 : 400 }}>
              {API_PRESETS[key].label}
            </button>
          ))}
        </div>

        {/* API URL */}
        <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "6px" }}>API BASE URL</label>
        <input
          value={customApiUrl}
          onChange={(e) => setCustomApiUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          style={{ width: "100%", background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: "7px", color: "#e0e0e0", padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "monospace", marginBottom: "12px", boxSizing: "border-box" }}
        />

        {/* API Key input */}
        <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "6px" }}>{preset.keyName.toUpperCase()}</label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
          <input
            type={showApiKey ? "text" : "password"}
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            placeholder={existingCustomKey ? "Enter a new key to replace the saved one" : preset.keyHint}
            style={{ flex: 1, background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: "7px", color: "#e0e0e0", padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "monospace" }}
          />
          <button onClick={() => setShowApiKey((v) => !v)}
            style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: "7px", color: "#666", padding: "8px 12px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", flexShrink: 0 }}>
            {showApiKey ? "Hide" : "Show"}
          </button>
          <button onClick={saveCustomKey} disabled={savingCustomKey || !customApiKey.trim()}
            style={{ background: customKeySaved ? "rgba(74,170,120,0.15)" : "rgba(99,102,241,0.12)", border: `1px solid ${customKeySaved ? "rgba(74,170,120,0.35)" : "rgba(99,102,241,0.3)"}`, borderRadius: "7px", color: customKeySaved ? "#4aaa78" : "#a5b4fc", padding: "8px 16px", cursor: (savingCustomKey || !customApiKey.trim()) ? "not-allowed" : "pointer", fontSize: "13px", fontFamily: "inherit", fontWeight: 600, flexShrink: 0, opacity: !customApiKey.trim() ? 0.4 : 1 }}>
            {customKeySaved ? "✓ Saved" : savingCustomKey ? "Saving…" : "Save Key"}
          </button>
        </div>
        {customKeySaveError && <div style={{ fontSize: "11px", color: "#e55", marginBottom: "8px" }}>{customKeySaveError}</div>}

        {/* How-to guide */}
        <div style={{ background: "#0a0a0a", border: "1px solid #161616", borderRadius: "10px", padding: "14px 16px", marginTop: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#555", letterSpacing: "0.1em", marginBottom: "10px" }}>HOW TO GET YOUR KEY</div>

          {selectedPreset !== "custom" && (
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
                1. Go to{" "}
                <a href={preset.keyLink} target="_blank" rel="noreferrer"
                  style={{ color: "#60b8ff", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>
                  {preset.keyLink}
                </a>
              </div>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>2. Sign in or create an account, then click <strong style={{ color: "#aaa" }}>Create new secret key</strong>.</div>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>3. Copy the key and paste it into the field above.</div>
              <div style={{ fontSize: "12px", color: "#888" }}>4. Click <strong style={{ color: "#aaa" }}>Save Key</strong>. Sam will use your key first and fall back to the free rotation if it has any issues.</div>
            </div>
          )}

          {selectedPreset === "custom" && (
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Enter the base URL of any <strong style={{ color: "#aaa" }}>OpenAI-compatible API</strong> (e.g. <code style={{ background: "#151515", padding: "1px 5px", borderRadius: "3px", fontSize: "11px" }}>https://your-provider.com/v1</code>).</div>
              <div style={{ fontSize: "12px", color: "#888" }}>Then paste your API key and click <strong style={{ color: "#aaa" }}>Save Key</strong>. Sam will try it first and fall back to the free rotation if it fails.</div>
            </div>
          )}

          <div style={{ borderTop: "1px solid #161616", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ fontSize: "11px", color: "#3a3a3a" }}>
              🔒 Your key is stored encrypted in your account on our server — it is never logged or shared.
            </div>
            <div style={{ fontSize: "11px", color: "#3a3a3a" }}>
              ⚡ If your key is rate-limited or returns an error, Sam automatically falls back to the free API rotation with no interruption.
            </div>
            {selectedPreset === "openai" && (
              <div style={{ fontSize: "11px", color: "#3a3a3a" }}>
                💡 OpenAI requires a paid account with credits. Free-tier accounts will return a 429 error and Sam will fall back gracefully.
              </div>
            )}
            {selectedPreset === "anthropic" && (
              <div style={{ fontSize: "11px", color: "#3a3a3a" }}>
                💡 Anthropic requires a paid account. New accounts get $5 free credit — enough for thousands of messages.
              </div>
            )}
            {selectedPreset === "groq" && (
              <div style={{ fontSize: "11px", color: "#3a3a3a" }}>
                💡 Groq has a generous free tier with very high speed. This is the same provider in Sam's free rotation, but your own key gives you higher rate limits.
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── 3. VAULT FILES ────────────────────────────────────────────────── */}
      <Section title="Knowledge Vault" subtitle="All files Sam can reference in any chat.">
        <input value={vaultSearch} onChange={(e) => setVaultSearch(e.target.value)} placeholder="Search vault files…"
          style={{ width: "100%", background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "8px", color: "#e0e0e0", padding: "8px 13px", fontSize: "12px", outline: "none", fontFamily: "inherit", marginBottom: "10px", boxSizing: "border-box" }} />
        {filteredVault.length === 0 && <div style={{ color: "#333", fontSize: "12px", padding: "16px 0" }}>{vaultFiles.length === 0 ? "No files in vault yet." : "No files match your search."}</div>}
        {filteredVault.map((f) => (
          <FileRow key={f.id} icon={fileIcon(f.name, f.type)} name={f.name}
            meta={`${formatSize(f.size)} · ${new Date(f.uploadedAt).toLocaleDateString()}`}
            onView={() => openVaultFile(f)} onDelete={() => deleteVault(f.id)} />
        ))}
      </Section>

      {/* ── 4. RESEARCH REPORTS ───────────────────────────────────────────── */}
      <Section title="Research Reports" subtitle="Completed research reports saved to vault.">
        <input value={researchSearch} onChange={(e) => setResearchSearch(e.target.value)} placeholder="Search research…"
          style={{ width: "100%", background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "8px", color: "#e0e0e0", padding: "8px 13px", fontSize: "12px", outline: "none", fontFamily: "inherit", marginBottom: "10px", boxSizing: "border-box" }} />
        {filteredResearch.length === 0 && <div style={{ color: "#333", fontSize: "12px", padding: "16px 0" }}>{researchJobs.length === 0 ? "No completed research yet." : "No research matches your search."}</div>}
        {filteredResearch.map((job) => (
          <FileRow key={job.id} icon="🔬" name={job.topic.length > 80 ? job.topic.slice(0, 80) + "…" : job.topic}
            meta={`${job.result ? formatSize(job.result.length) : "—"} · ${new Date(job.completedAt ?? job.createdAt).toLocaleDateString()}${job.savedToVault ? " · in vault" : ""}`}
            onView={() => openResearch(job)} onDelete={() => deleteResearch(job.id)} />
        ))}
      </Section>

      {/* ── 5. ACCOUNT ────────────────────────────────────────────────────── */}
      <Section title="Account">
        <button
          onClick={() => { logout(); router.replace("/login"); }}
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", color: "#f87171", padding: "10px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}>
          Sign Out
        </button>
      </Section>

      {/* ── 6. ABOUT ──────────────────────────────────────────────────────── */}
      <Section title="About">
        <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "16px 18px", fontSize: "12px", color: "#555", lineHeight: 1.7 }}>
          <div style={{ color: "#888", fontWeight: 700, marginBottom: "4px" }}>Sammy OS</div>
          <div>AI-powered desktop assistant with screen awareness, knowledge vault, folder analysis, and autonomous research.</div>
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#3a3a3a" }}>Built with Tauri · Next.js 15 · Rust · Upstash Redis</div>
        </div>
      </Section>

      {loadingView && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "#60b8ff", fontSize: "13px" }}>Loading…</div>
        </div>
      )}

      {viewerOpen && <FileViewer title={viewerTitle} content={viewerContent} onClose={() => setViewerOpen(false)} />}

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 4px; }
        select option { background: #1a1a1a; }
      `}</style>
    </div>
  );
}