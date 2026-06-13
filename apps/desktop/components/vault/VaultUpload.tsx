"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface VaultUploadProps {
  onUploadComplete: () => void;
}

const ACCEPTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".java",
  ".css", ".html", ".json", ".md", ".txt", ".sql",
  ".yaml", ".yml", ".sh", ".rs", ".go", ".rb",
  ".php", ".c", ".cpp", ".h", ".cs", ".swift",
  ".kt", ".r", ".m", ".scala", ".toml", ".env",
]);

const IGNORED_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build",
  ".cache", "coverage", "__pycache__", ".turbo",
  "out", ".vercel", "target",
]);

const BATCH_SIZE = 25;
const MAX_FILE_BYTES = 300 * 1024; // 300KB per file
const MAX_POLL_ATTEMPTS = 72; // 6 minutes at 5s intervals

function isBinary(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 512));
  for (const b of bytes) {
    if (b === 0) return true;
  }
  return false;
}

export default function VaultUpload({ onUploadComplete }: VaultUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [jobPolling, setJobPolling] = useState<string | null>(null);
  const [pollingFolderName, setPollingFolderName] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef<number>(0);

  // Auto-resume pending jobs on mount
  useEffect(() => {
    async function checkPendingJobs() {
      try {
        const res = await fetch("/api/vault/pending-jobs");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.jobs || data.jobs.length === 0) return;

        const job = data.jobs[0];

        const cancelledJobs = JSON.parse(sessionStorage.getItem("nexus-cancelled-jobs") ?? "[]");
        if (cancelledJobs.includes(job.jobId)) return;

        try {
          const checkRes = await fetch(`/api/vault/analyze-folder?jobId=${job.jobId}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            const status = checkData.status?.status;
            const hasResult = checkData.status?.hasResult;

            if (hasResult || status === "complete" || status === "failed" || !status) {
              await fetch(`/api/vault/pending-jobs?jobId=${job.jobId}`, { method: "DELETE" });
              if (hasResult || status === "complete") onUploadComplete();
              return;
            }
          } else {
            await fetch(`/api/vault/pending-jobs?jobId=${job.jobId}`, { method: "DELETE" });
            return;
          }
        } catch {
          await fetch(`/api/vault/pending-jobs?jobId=${job.jobId}`, { method: "DELETE" }).catch(() => {});
          return;
        }

        setPollingFolderName(job.folderName);
        setUploadStatus(`Resuming analysis for "${job.folderName}"…`);
        startPolling(job.jobId);
      } catch {
        // no pending jobs or endpoint not ready
      }
    }
    checkPendingJobs();
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Pings nexus-analyzer to increment the vault_upload counter on the live dashboard.
  // Must use the full URL — relative URLs resolve to localhost:3000 which has no such route.
  async function pingVault() {
    try {
      await fetch("https://nexus-analyzer-three.vercel.app/api/vault/ping", {
        method: "POST",
      });
    } catch {
      // fire-and-forget — never block the UI
    }
  }

  // Small delay before calling onUploadComplete so the Next.js local API has time
  // to flush the write to .vault-store.json before the vault list refetches.
  async function notifyComplete() {
    await new Promise((r) => setTimeout(r, 400));
    onUploadComplete();
  }

  async function handleClearJob() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (jobPolling) {
      try {
        const cancelled = JSON.parse(sessionStorage.getItem("nexus-cancelled-jobs") ?? "[]");
        if (!cancelled.includes(jobPolling)) {
          cancelled.push(jobPolling);
          sessionStorage.setItem("nexus-cancelled-jobs", JSON.stringify(cancelled));
        }
      } catch { /* ignore */ }
      try {
        await fetch(`/api/vault/pending-jobs?jobId=${jobPolling}`, { method: "DELETE" });
      } catch { /* ignore */ }
    }
    pollAttemptsRef.current = 0;
    setJobPolling(null);
    setPollingFolderName(null);
    setUploadStatus(null);
  }

  

async function startPolling(jobId: string) {
  let attempts = 0;
  const MAX_ATTEMPTS = 72; // 6 minutes at 5s intervals

  setJobPolling(jobId); // ← track so cancel button appears and is functional

  const interval = setInterval(async () => {
    attempts++;

    if (attempts > MAX_ATTEMPTS) {
      clearInterval(interval);
      setIsUploading(false);
      setUploadStatus("⚠️ Analysis timed out. The job may still be processing — check back later.");
      return;
    }

    try {
      const res = await fetch(`/api/vault/analyze-folder?jobId=${encodeURIComponent(jobId)}`);
      if (!res.ok) {
        // Non-2xx from the route itself — keep trying, might be transient
        return;
      }
      const data = await res.json();

      // Handle both possible status shapes from the route
      const isDone =
  data.status === "done" ||
  data.status === "complete" ||      // ← this is what analyze-folder actually returns
  data.status?.hasResult === true ||
  data.status?.status === "complete" ||
  data.done === true;

      const isFailed =
        data.status === "error" ||
        data.status?.status === "failed" ||
        data.error != null;

      if (isDone) {
        clearInterval(interval);
        // Clean up the pending job entry
        await fetch(`/api/vault/pending-jobs`, {
  method: "DELETE",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jobId }),
}).catch(() => {});
        setIsUploading(false);
        setUploadStatus("✅ Analysis complete! Files saved to vault.");
        setJobPolling(null);
        pingVault();
        notifyComplete();
      } else if (isFailed) {
        clearInterval(interval);
        await fetch(`/api/vault/pending-jobs`, {
  method: "DELETE",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jobId }),
}).catch(() => {});
        setIsUploading(false);
        setJobPolling(null);
        setUploadStatus(`❌ Analysis failed: ${data.error ?? data.status?.error ?? "Unknown error"}`);
      }
      // any other status → still pending, keep polling
    } catch {
      // Network blip — keep trying until MAX_ATTEMPTS
    }
  }, 5000);
}

  async function uploadSingleFile(file: File) {
    setIsUploading(true);
    setUploadStatus(`Uploading "${file.name}"…`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/vault/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      setUploadStatus(`✅ "${file.name}" uploaded to vault.`);
      pingVault();
      notifyComplete();
    } catch (err: any) {
      setUploadStatus(`❌ Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    if (files.length === 1) {
      await uploadSingleFile(files[0]);
    } else {
      setUploadStatus("Drop one file at a time for single-file upload.");
    }
  }, []);

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await uploadSingleFile(files[0]);
    e.target.value = "";
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;
    e.target.value = "";

    setIsUploading(true);
    setUploadStatus("Reading files…");

    const accepted: { path: string; content: string }[] = [];
    for (const file of rawFiles) {
      const relativePath = (file as any).webkitRelativePath as string || file.name;
      const parts = relativePath.split("/");
      if (parts.some((p) => IGNORED_DIRS.has(p))) continue;
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.has(ext)) continue;
      if (file.size > MAX_FILE_BYTES) continue;
      try {
        const buffer = await file.arrayBuffer();
        if (isBinary(buffer)) continue;
        const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
        accepted.push({ path: relativePath, content: text });
      } catch {
        continue;
      }
    }

    if (accepted.length === 0) {
      setUploadStatus("No supported files found in this folder.");
      setIsUploading(false);
      return;
    }

    const folderName = (rawFiles[0] as any).webkitRelativePath?.split("/")[0] || "Project";
    setPollingFolderName(folderName);
    setUploadStatus(`Found ${accepted.length} files — uploading…`);

    const batches: { path: string; content: string }[][] = [];
    for (let i = 0; i < accepted.length; i += BATCH_SIZE) {
      batches.push(accepted.slice(i, i + BATCH_SIZE));
    }

    let jobId: string | null = null;

    for (let i = 0; i < batches.length; i++) {
      setUploadStatus(`Uploading batch ${i + 1}/${batches.length}…`);
      try {
        const body: any = {
          folderName,
          files: batches[i],
          batchIndex: i,
          totalBatches: batches.length,
        };
        if (jobId) body.jobId = jobId;

        const res = await fetch("/api/vault/analyze-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error(`Batch ${i + 1} upload failed`);
        const data = await res.json();
        if (i === 0) {
          jobId = data.jobId;
          if (jobId) {
            await fetch("/api/vault/pending-jobs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jobId, folderName }),
            });
          }
        }

        if (i < batches.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (err: any) {
        setUploadStatus(`❌ Upload error: ${err.message}`);
        setIsUploading(false);
        setPollingFolderName(null);
        return;
      }
    }

    setIsUploading(false);
    setUploadStatus(`All ${accepted.length} files uploaded — analysis starting…`);
    if (jobId) startPolling(jobId);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Single-file drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? "#00f5ff" : "#334"}`,
          borderRadius: "12px",
          padding: "28px 20px",
          textAlign: "center",
          cursor: isUploading ? "not-allowed" : "pointer",
          background: isDragging ? "rgba(0,245,255,0.05)" : "rgba(255,255,255,0.02)",
          transition: "all 0.2s ease",
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: "28px", marginBottom: "8px" }}>📄</div>
        <div style={{ color: isDragging ? "#00f5ff" : "#aaa", fontSize: "14px", fontWeight: 500 }}>
          {isUploading ? "Uploading…" : "Drop a file here or click to browse"}
        </div>
        <div style={{ color: "#555", fontSize: "12px", marginTop: "4px" }}>
          PDF, TXT, MD, TS, JS, PY, JSON, and more
        </div>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
          disabled={isUploading}
        />
      </div>

      {/* Folder upload button */}
      <button
        onClick={() => folderInputRef.current?.click()}
        disabled={isUploading || !!jobPolling}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "12px 20px",
          background: isUploading || jobPolling ? "rgba(255,255,255,0.04)" : "rgba(0,245,255,0.08)",
          border: `1px solid ${isUploading || jobPolling ? "#334" : "#00f5ff44"}`,
          borderRadius: "10px",
          color: isUploading || jobPolling ? "#555" : "#00f5ff",
          fontSize: "14px",
          fontWeight: 600,
          cursor: isUploading || jobPolling ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          width: "100%",
        }}
      >
        <span style={{ fontSize: "18px" }}>📁</span>
        Upload Entire Project Folder
        <input
          ref={folderInputRef}
          type="file"
          style={{ display: "none" }}
          // @ts-ignore — webkitdirectory is not in React's type definitions
          webkitdirectory="true"
          multiple
          onChange={handleFolderUpload}
          disabled={isUploading || !!jobPolling}
        />
      </button>

      {/* Status message */}
      {uploadStatus && (
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "10px 14px",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid #334",
          color: uploadStatus.startsWith("✅")
            ? "#4cff8a"
            : uploadStatus.startsWith("❌")
            ? "#ff5555"
            : uploadStatus.startsWith("⚠️")
            ? "#ffaa44"
            : "#00f5ff",
          fontSize: "13px",
          lineHeight: 1.5,
        }}>
          <span style={{ flex: 1 }}>{uploadStatus}</span>
          {/* Cancel button while polling OR after timeout warning */}
          {(jobPolling || uploadStatus.startsWith("⚠️")) && (
            <button
              onClick={handleClearJob}
              title="Cancel analysis and clear this job"
              style={{
                background: "rgba(255,85,85,0.1)",
                border: "1px solid #ff555544",
                borderRadius: "5px",
                color: "#ff5555",
                fontSize: "11px",
                padding: "2px 8px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Cancel
            </button>
          )}
          {/* Dismiss button once fully done */}
          {!jobPolling && !uploadStatus.startsWith("⚠️") && (uploadStatus.startsWith("✅") || uploadStatus.startsWith("❌")) && (
            <button
              onClick={() => setUploadStatus(null)}
              style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: 0, flexShrink: 0 }}
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}