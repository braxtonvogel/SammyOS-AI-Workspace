"use client";

import { useState } from "react";

interface VaultFileEntry {
  id: string;
  name: string;
  type: string;
  size: number;
  preview: string;
  charCount: number;
  uploadedAt: string;
}

interface FolderCardProps {
  folderName: string;
  files: VaultFileEntry[];
  onDelete: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["ts", "tsx", "js", "jsx"].includes(ext || "")) return "⚡";
  if (["py"].includes(ext || "")) return "🐍";
  if (["md"].includes(ext || "")) return "📝";
  if (["pdf"].includes(ext || "")) return "📄";
  if (["csv"].includes(ext || "")) return "📊";
  if (["json", "yaml", "yml"].includes(ext || "")) return "⚙️";
  if (["sql"].includes(ext || "")) return "🗄️";
  if (["java"].includes(ext || "")) return "☕";
  return "📁";
}

export function FolderCard({ folderName, files, onDelete }: FolderCardProps) {
  const [expanded, setExpanded] = useState(false);

  const summaryFile = files.find((f) => f.name.endsWith("CODEBASE_SUMMARY.md"));
  const otherFiles = files.filter((f) => !f.name.endsWith("CODEBASE_SUMMARY.md"));
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const totalChars = files.reduce((acc, f) => acc + f.charCount, 0);

  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden
                    hover:border-zinc-600 transition-all duration-200">

      {/* Folder header — click to expand */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-zinc-900/50 transition"
      >
        {/* Arrow */}
        <span className={`text-zinc-500 text-xs transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>
          ▶
        </span>

        {/* Folder icon */}
        <span className="text-xl">📁</span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate pr-2">{folderName}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {files.length} file{files.length !== 1 ? "s" : ""} · {formatSize(totalSize)} · {totalChars.toLocaleString()} chars
          </p>
        </div>

        {/* Summary badge */}
        {summaryFile && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-400/10
                           text-cyan-400 border border-cyan-400/20 shrink-0">
            AI Summary
          </span>
        )}

        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800
                         text-zinc-400 shrink-0">
          Sam can read this
        </span>
      </button>

      {/* Expanded file list */}
      {expanded && (
        <div className="border-t border-zinc-800">

          {/* Summary file first */}
          {summaryFile && (
            <div className="flex items-start gap-3 px-4 py-3 bg-cyan-400/5
                            border-b border-zinc-800">
              <span className="text-lg mt-0.5">📝</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-cyan-300">
                  CODEBASE_SUMMARY.md
                </p>
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                  {summaryFile.preview}...
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(summaryFile.id); }}
                className="text-zinc-600 hover:text-red-400 transition text-xs shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
          )}

          {/* Individual files */}
          {otherFiles.map((file) => {
            const fileName = file.name.split("/").pop() || file.name;
            return (
              <div
                key={file.id}
                className="flex items-start gap-3 px-4 py-3 border-b
                           border-zinc-800/50 last:border-0 hover:bg-zinc-900/30 transition"
              >
                <span className="text-base mt-0.5">{fileIcon(fileName)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-300 truncate">
                    {fileName}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {formatSize(file.size)} · {file.charCount.toLocaleString()} chars
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
                  className="text-zinc-600 hover:text-red-400 transition text-xs shrink-0 mt-0.5"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}