"use client";

import { useEffect, useState, useCallback } from "react";
import VaultUpload from "@/components/vault/VaultUpload";
import { FileViewerModal } from "@/components/vault/FileViewerModal";

interface VaultFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  preview: string;
}

interface FolderGroup {
  folderName: string;
  files: VaultFile[];
  hasSummary: boolean;
  hasExamples: boolean;
  totalSize: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function VaultPage() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);
  const [search, setSearch] = useState("");
  const [viewingFile, setViewingFile] = useState<VaultFile & { content?: string } | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loadingView, setLoadingView] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/vault/list");
      if (!res.ok) return;
      const data = await res.json();
      setFiles(data.files || []);
      setRefreshCount((c) => c + 1);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  async function handleView(file: VaultFile) {
    setLoadingView(file.id);
    try {
      const res = await fetch(`/api/vault/content?id=${file.id}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setViewingFile({ ...file, content: data.content } as any);
    } catch {
      setViewingFile({ ...file, content: file.preview || "(No content)" } as any);
    } finally {
      setLoadingView(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/vault/delete?id=${id}`, { method: "DELETE" });
      await loadFiles();
    } finally {
      setDeletingId(null);
    }
  }

  function toggleFolder(folderName: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) next.delete(folderName);
      else next.add(folderName);
      return next;
    });
  }

  // Group files
  const standaloneFiles = files.filter((f) => !f.name.includes("/"));
  const folderFiles = files.filter((f) => f.name.includes("/"));

  const folderMap = new Map<string, VaultFile[]>();
  for (const f of folderFiles) {
    const folder = f.name.split("/")[0];
    if (!folderMap.has(folder)) folderMap.set(folder, []);
    folderMap.get(folder)!.push(f);
  }

  const folderGroups: FolderGroup[] = Array.from(folderMap.entries()).map(
    ([folderName, fls]) => ({
      folderName,
      files: fls,
      hasSummary: fls.some((f) => f.name.includes("CODEBASE_SUMMARY")),
      hasExamples: fls.some((f) => f.name.includes("CODE_EXAMPLES")),
      totalSize: fls.reduce((a, b) => a + b.size, 0),
    })
  );

  // Search filter
  const q = search.toLowerCase();
  const filteredStandalone = standaloneFiles.filter(
    (f) => !q || f.name.toLowerCase().includes(q) || f.preview?.toLowerCase().includes(q)
  );
  const filteredFolders = folderGroups
    .map((g) => ({
      ...g,
      files: g.files.filter(
        (f) => !q || f.name.toLowerCase().includes(q) || f.preview?.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => !q || g.files.length > 0 || g.folderName.toLowerCase().includes(q));

  const totalSize = files.reduce((a, b) => a + b.size, 0);

  const cellStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid #1e2030",
    borderRadius: "10px",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  };

  const btnStyle = (color: string): React.CSSProperties => ({
    padding: "4px 10px",
    fontSize: "12px",
    borderRadius: "6px",
    border: `1px solid ${color}44`,
    background: `${color}11`,
    color,
    cursor: "pointer",
    transition: "all 0.15s",
    flexShrink: 0,
  });

  return (
    <div style={{
      height: "100%",
      overflowY: "auto",
      padding: "24px",
      background: "#0a0a0f",
      color: "#e2e8f0",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{
          fontSize: "22px", fontWeight: 700, margin: 0,
          background: "linear-gradient(135deg, #00f5ff, #0066ff)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Knowledge Vault
        </h1>
        <p style={{ color: "#666", fontSize: "13px", margin: "4px 0 0" }}>
          {files.length} file{files.length !== 1 ? "s" : ""} · {formatSize(totalSize)} total
        </p>
      </div>

      {/* ── UPLOAD SECTION ── */}
      <div style={{
        background: "rgba(0,245,255,0.03)",
        border: "1px solid #1a2a3a",
        borderRadius: "14px",
        padding: "18px",
        marginBottom: "20px",
      }}>
        <VaultUpload onUploadComplete={loadFiles} />
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search vault…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 14px",
          marginBottom: "16px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid #2a2a3a",
          borderRadius: "8px",
          color: "#e2e8f0",
          fontSize: "14px",
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      {/* File list — key forces re-render after every upload/delete */}
      <div key={refreshCount}>

      {/* Folder groups */}
      {filteredFolders.map((group) => (
        <div key={group.folderName} style={{ marginBottom: "12px" }}>
          {/* Folder header */}
          <div
            onClick={() => toggleFolder(group.folderName)}
            style={{
              ...cellStyle,
              cursor: "pointer",
              justifyContent: "space-between",
              background: "rgba(0,102,255,0.06)",
              border: "1px solid #1a2540",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <span style={{ fontSize: "18px" }}>
                {expandedFolders.has(group.folderName) ? "📂" : "📁"}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "#c0d8ff" }}>
                  {group.folderName}
                </div>
                <div style={{ fontSize: "12px", color: "#556" }}>
                  {group.files.length} files · {formatSize(group.totalSize)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              {group.hasSummary && (
                <span style={{
                  fontSize: "11px", padding: "2px 7px", borderRadius: "12px",
                  background: "rgba(0,245,255,0.1)", border: "1px solid #00f5ff44",
                  color: "#00f5ff", fontWeight: 600,
                }}>AI Summary</span>
              )}
              {group.hasExamples && (
                <span style={{
                  fontSize: "11px", padding: "2px 7px", borderRadius: "12px",
                  background: "rgba(255,180,0,0.1)", border: "1px solid #ffb40044",
                  color: "#ffb400", fontWeight: 600,
                }}>Code Examples</span>
              )}
              <span style={{ color: "#556", fontSize: "16px", marginLeft: "4px" }}>
                {expandedFolders.has(group.folderName) ? "▲" : "▼"}
              </span>
            </div>
          </div>

          {/* Folder files */}
          {expandedFolders.has(group.folderName) && (
            <div style={{
              borderLeft: "2px solid #1a2540",
              marginLeft: "20px",
              paddingLeft: "12px",
              marginTop: "4px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}>
              {group.files.map((file) => {
                const isSummary = file.name.includes("CODEBASE_SUMMARY");
                const isExamples = file.name.includes("CODE_EXAMPLES");
                const shortName = file.name.split("/").slice(1).join("/");
                return (
                  <div key={file.id} style={{
                    ...cellStyle,
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    border: `1px solid ${isSummary ? "#00f5ff22" : isExamples ? "#ffb40022" : "#1e2030"}`,
                    background: isSummary
                      ? "rgba(0,245,255,0.04)"
                      : isExamples
                      ? "rgba(255,180,0,0.04)"
                      : "rgba(255,255,255,0.02)",
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: "13px", fontWeight: 500, color: isSummary ? "#00f5ff" : isExamples ? "#ffb400" : "#ccc",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {shortName}
                      </div>
                      <div style={{ fontSize: "11px", color: "#556" }}>
                        {formatSize(file.size)} · {formatDate(file.uploadedAt)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => handleView(file)}
                        disabled={loadingView === file.id}
                        style={btnStyle("#00f5ff")}
                      >
                        {loadingView === file.id ? "…" : "View"}
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        disabled={deletingId === file.id}
                        style={btnStyle("#ff5555")}
                      >
                        {deletingId === file.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Standalone files */}
      {filteredStandalone.map((file) => (
        <div key={file.id} style={{ ...cellStyle, justifyContent: "space-between", marginBottom: "6px" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: "14px", fontWeight: 500, color: "#ccc",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {file.name.startsWith("Research:") ? "🔬 " : "📄 "}{file.name}
            </div>
            <div style={{ fontSize: "12px", color: "#556", marginTop: "2px" }}>
              {formatSize(file.size)} · {formatDate(file.uploadedAt)}
            </div>
            {file.preview && (
              <div style={{
                fontSize: "12px", color: "#445", marginTop: "4px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {file.preview}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            <button
              onClick={() => handleView(file)}
              disabled={loadingView === file.id}
              style={btnStyle("#00f5ff")}
            >
              {loadingView === file.id ? "…" : "View"}
            </button>
            <button
              onClick={() => handleDelete(file.id)}
              disabled={deletingId === file.id}
              style={btnStyle("#ff5555")}
            >
              {deletingId === file.id ? "…" : "Delete"}
            </button>
          </div>
        </div>
      ))}

      {/* Empty state */}
      {filteredStandalone.length === 0 && filteredFolders.length === 0 && (
        <div style={{
          textAlign: "center", color: "#445", padding: "48px 20px",
          fontSize: "14px",
        }}>
          {search ? "No files match your search." : "No files in vault yet. Upload something above."}
        </div>
      )}

      </div> {/* end keyed file list */}

      {/* File viewer modal */}
      {viewingFile && (
        <FileViewerModal
          file={viewingFile as any}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  );
}