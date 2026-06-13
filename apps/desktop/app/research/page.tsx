"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ResearchJob {
  id: string;
  topic: string;
  status: "queued" | "researching" | "waiting_tokens" | "complete" | "failed";
  progress: string;
  progressStep: number;
  progressTotal: number;
  result?: string;
  createdAt: number;
  completedAt?: number;
  savedToVault?: boolean;
}

// ─── Globe ────────────────────────────────────────────────────────────────────

function GlobeCanvas({ active }: { active: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const sceneRef = useRef<any>(null);
  const activeRef = useRef(active);

  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    const doInit = () => init(el);

    if ((window as any).THREE) { doInit(); return cleanup; }

    const existingScript = document.querySelector('script[data-nexus-three="1"]');
    if (existingScript) {
      existingScript.addEventListener("load", doInit);
      return () => { existingScript.removeEventListener("load", doInit); cleanup(); };
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.setAttribute("data-nexus-three", "1");
    script.onload = doInit;
    document.head.appendChild(script);
    return cleanup;

    function init(container: HTMLDivElement) {
      const THREE = (window as any).THREE;
      if (!THREE || !container) return;

      const W = container.clientWidth || 500;
      const H = container.clientHeight || 500;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
      camera.position.z = 3.2;

      const COUNT = 420;
      const positions: number[] = [];
      const phi = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < COUNT; i++) {
        const y = 1 - (i / (COUNT - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = phi * i;
        positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.025, transparent: true, opacity: 0.75, sizeAttenuation: true });
      const points = new THREE.Points(geo, mat);
      scene.add(points);

      const lineMat = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.18 });
      const posArr = geo.attributes.position.array as Float32Array;
      const linePositions: number[] = [];
      const threshold = 0.38;
      for (let i = 0; i < COUNT; i++) {
        const ax = posArr[i * 3], ay = posArr[i * 3 + 1], az = posArr[i * 3 + 2];
        for (let j = i + 1; j < COUNT; j++) {
          const bx = posArr[j * 3], by = posArr[j * 3 + 1], bz = posArr[j * 3 + 2];
          const d = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2);
          if (d < threshold) linePositions.push(ax, ay, az, bx, by, bz);
        }
      }
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      scene.add(lines);

      sceneRef.current = { renderer, scene, camera, points, lines, mat, lineMat };

      let frame = 0;
      const animate = () => {
        animRef.current = requestAnimationFrame(animate);
        frame++;
        const isActive = activeRef.current;
        const speed = isActive ? 0.0025 : 0.0008;
        points.rotation.y += speed;
        lines.rotation.y += speed;
        points.rotation.x = Math.sin(frame * 0.002) * 0.08;
        lines.rotation.x = Math.sin(frame * 0.002) * 0.08;
        if (isActive) {
          mat.opacity = 0.6 + Math.sin(frame * 0.05) * 0.2;
          lineMat.opacity = 0.15 + Math.sin(frame * 0.05) * 0.1;
          mat.color.setHex(0x88ccff);
          lineMat.color.setHex(0x4488cc);
        } else {
          mat.opacity = 0.65; lineMat.opacity = 0.16;
          mat.color.setHex(0xaaaaaa); lineMat.color.setHex(0x888888);
        }
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        if (!container) return;
        renderer.setSize(container.clientWidth, container.clientHeight);
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", onResize);
      sceneRef.current.onResize = onResize;
    }

    function cleanup() {
      cancelAnimationFrame(animRef.current);
      if (sceneRef.current) {
        const { renderer, onResize } = sceneRef.current;
        if (onResize) window.removeEventListener("resize", onResize);
        renderer.dispose();
        renderer.domElement.parentNode?.removeChild(renderer.domElement);
        sceneRef.current = null;
      }
    }
  }, []);

  return (
    <div ref={mountRef} style={{
      width: "min(62vh, 62vw)",
      height: "min(62vh, 62vw)",
      position: "relative",
      pointerEvents: "none",
    }} />
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function ResearchDropdown({ jobs, onSelect, onDelete }: {
  jobs: ResearchJob[];
  onSelect: (job: ResearchJob) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const completed = jobs.filter((j) => j.status === "complete");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", zIndex: 20 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px", color: "#ccc", padding: "8px 16px", fontSize: "13px",
          cursor: "pointer", backdropFilter: "blur(8px)",
          fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em", transition: "background 0.2s",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M3 7h18M3 12h18M3 17h18" />
        </svg>
        Saved Research
        <span style={{ background: "rgba(100,180,255,0.15)", color: "#60b8ff", borderRadius: "999px", padding: "0 8px", fontSize: "11px", fontWeight: 700 }}>
          {completed.length}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0,
          minWidth: "340px", maxHeight: "360px", overflowY: "auto",
          background: "rgba(12,12,16,0.95)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px", backdropFilter: "blur(20px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)", padding: "6px",
        }}>
          {completed.length === 0 && (
            <div style={{ padding: "20px", color: "#555", fontSize: "12px", textAlign: "center" }}>
              No completed research yet.
            </div>
          )}
          {completed.map((job) => (
            <div
              key={job.id}
              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "7px", cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => { onSelect(job); setOpen(false); }}
            >
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: "13px", color: "#e0e0e0", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {job.topic}
                </div>
                <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>
                  {new Date(job.completedAt ?? job.createdAt).toLocaleDateString()} · {Math.round((job.result?.length ?? 0) / 1000)}k chars
                  {job.savedToVault && <span style={{ color: "#4a9" }}> · in vault</span>}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
                style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: "4px", borderRadius: "4px", flexShrink: 0 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({ step, total }: { step: number; total: number }) {
  const pct = total > 0 ? Math.min(step / total, 1) : 0;
  const r = 36;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="88" height="88" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="#60b8ff" strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [input, setInput] = useState("");
  const [activeJob, setActiveJob] = useState<ResearchJob | null>(null);
  const [selectedResult, setSelectedResult] = useState<ResearchJob | null>(null);
  const [statusText, setStatusText] = useState("Ready to research");
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isResearching = activeJob !== null &&
    (activeJob.status === "researching" || activeJob.status === "queued" || activeJob.status === "waiting_tokens");

  useEffect(() => {
    fetch("/api/research/list")
      .then((r) => r.json())
      .then((data) => {
        const jobs = data.jobs ?? [];
        setJobs(jobs);
        const inProgress = jobs.find(
          (j: ResearchJob) => j.status === "researching" || j.status === "queued" || j.status === "waiting_tokens"
        );
        if (inProgress) { setActiveJob(inProgress); startPolling(inProgress.id); }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    const topic = input.trim();
    if (!topic || isResearching) return;
    setInput("");
    setSelectedResult(null);
    try {
      const res = await fetch("/api/research/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      const newJob: ResearchJob = {
        id: data.jobId, topic, status: "queued",
        progress: "Starting research…", progressStep: 0, progressTotal: 10, createdAt: Date.now(),
      };
      setActiveJob(newJob);
      setJobs((prev) => [newJob, ...prev]);
      startPolling(data.jobId);
    } catch {
      setStatusText("Failed to start research — check connection.");
    }
  };

  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/research/status?jobId=${jobId}`);
        const data = await res.json();
        const updated: ResearchJob = data.job;
        setActiveJob(updated);
        setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
        setStatusText(updated.progress ?? "Researching…");
        if (updated.status === "complete" || updated.status === "failed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          if (updated.status === "complete") { setSelectedResult(updated); setStatusText("Research complete"); }
          else { setStatusText("Research failed — try again."); }
          setActiveJob(null);
        }
      } catch {}
    }, 4000);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/research/delete?jobId=${id}`, { method: "DELETE" }).catch(() => {});
    setJobs((prev) => prev.filter((j) => j.id !== id));
    if (selectedResult?.id === id) setSelectedResult(null);
  };

  const statusLabel = () => {
    if (!activeJob) return statusText;
    switch (activeJob.status) {
      case "queued": return "Queued…";
      case "researching": return activeJob.progress ?? "Researching…";
      case "waiting_tokens": return "⏳ Rate limit reached — waiting for token refresh…";
      default: return statusText;
    }
  };

  return (
    <div style={{
      position: "relative", display: "flex", flexDirection: "column",
      height: "100%", minHeight: 0, background: "#080808",
      overflow: "hidden", fontFamily: "'DM Mono', 'Fira Mono', 'Courier New', monospace",
      color: "#e0e0e0",
    }}>

      {/* ── Globe — single centered instance ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        <GlobeCanvas active={isResearching} />
      </div>

      {/* ── Vignette ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
        background: "radial-gradient(ellipse 60% 60% at 50% 50%, transparent 40%, #080808 100%)",
      }} />

      {/* ── Top bar ── */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 24px 0", flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: "11px", letterSpacing: "0.18em", color: "#555", textTransform: "uppercase", marginBottom: "2px" }}>
            Sammy OS
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#e8e8e8", letterSpacing: "-0.02em" }}>
            Research
          </div>
        </div>
        <ResearchDropdown jobs={jobs} onSelect={setSelectedResult} onDelete={handleDelete} />
      </div>

      {/* ── Centre content ── */}
      <div style={{
        position: "relative", zIndex: 10, flex: 1,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "0 32px", minHeight: 0, overflow: "hidden",
      }}>
        {/* Active job progress */}
        {isResearching && activeJob && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", animation: "fadeIn 0.5s ease" }}>
            <div style={{ position: "relative", width: "88px", height: "88px" }}>
              <ProgressRing step={activeJob.progressStep} total={activeJob.progressTotal} />
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "13px", color: "#60b8ff", fontWeight: 700,
              }}>
                {activeJob.progressTotal > 0
                  ? `${Math.round((activeJob.progressStep / activeJob.progressTotal) * 100)}%`
                  : "…"}
              </div>
            </div>
            <div style={{ textAlign: "center", maxWidth: "380px", fontSize: "13px", color: "#888", lineHeight: 1.6 }}>
              <div style={{ color: "#ddd", fontWeight: 600, marginBottom: "4px", fontSize: "14px" }}>{activeJob.topic}</div>
              <div>{statusLabel()}</div>
              {activeJob.status === "waiting_tokens" && (
                <div style={{
                  marginTop: "8px", fontSize: "11px", color: "#f0a020",
                  background: "rgba(240,160,32,0.08)", border: "1px solid rgba(240,160,32,0.2)",
                  borderRadius: "6px", padding: "6px 12px",
                }}>
                  Waiting for API token refresh. Will automatically resume — do not close the app.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completed result */}
        {!isResearching && selectedResult && (
          <div style={{
            width: "100%", maxWidth: "680px", maxHeight: "100%",
            display: "flex", flexDirection: "column",
            background: "rgba(14,14,18,0.85)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px", backdropFilter: "blur(16px)", overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#e8e8e8" }}>{selectedResult.topic}</div>
                <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>
                  {new Date(selectedResult.completedAt ?? selectedResult.createdAt).toLocaleString()}
                  {selectedResult.savedToVault && <span style={{ color: "#4aaa88", marginLeft: "8px" }}>✓ Saved to vault</span>}
                </div>
              </div>
              <button onClick={() => setSelectedResult(null)}
                style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "4px" }}>
                ✕
              </button>
            </div>
            <div style={{
              padding: "16px 18px", overflowY: "auto", flex: 1,
              fontSize: "12.5px", lineHeight: 1.75, color: "#c8c8c8",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {selectedResult.result}
            </div>
          </div>
        )}

        {/* Idle */}
        {!isResearching && !selectedResult && (
          <div style={{ textAlign: "center", color: "#333", fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase", pointerEvents: "none" }}>
            Ask Sam to research any topic
          </div>
        )}
      </div>

      {/* ── Bottom chatbox ── */}
      <div style={{ position: "relative", zIndex: 10, flexShrink: 0, padding: "0 24px 20px" }}>
        <div style={{
          background: "rgba(12,12,18,0.88)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "12px", backdropFilter: "blur(20px)", overflow: "hidden",
        }}>
          {isResearching && (
            <div style={{
              height: "2px",
              background: "linear-gradient(90deg, transparent, #60b8ff, transparent)",
              animation: "slideGlow 2s ease infinite",
            }} />
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", padding: "12px 14px" }}>
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder={isResearching ? "Research in progress — please wait…" : "What should Sam research? (Enter to start)"}
              disabled={isResearching}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "#e0e0e0", fontSize: "13px", fontFamily: "inherit",
                resize: "none", lineHeight: 1.6, opacity: isResearching ? 0.4 : 1,
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={isResearching || !input.trim()}
              style={{
                flexShrink: 0,
                background: isResearching || !input.trim() ? "rgba(255,255,255,0.05)" : "rgba(96,184,255,0.15)",
                border: "1px solid",
                borderColor: isResearching || !input.trim() ? "rgba(255,255,255,0.08)" : "rgba(96,184,255,0.35)",
                borderRadius: "8px",
                color: isResearching || !input.trim() ? "#444" : "#60b8ff",
                padding: "8px 18px", cursor: isResearching || !input.trim() ? "not-allowed" : "pointer",
                fontSize: "12px", fontFamily: "inherit", fontWeight: 700,
                letterSpacing: "0.06em", textTransform: "uppercase", transition: "all 0.2s",
              }}
            >
              {isResearching ? "Working…" : "Research"}
            </button>
          </div>
        </div>
        <div style={{
          fontSize: "10px", color: isResearching ? "#60b8ff" : "#383838",
          marginTop: "6px", paddingLeft: "2px", letterSpacing: "0.04em", transition: "color 0.5s",
        }}>
          {statusLabel()}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideGlow { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }
      `}</style>
    </div>
  );
}