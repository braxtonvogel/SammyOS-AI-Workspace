"use client";

interface FileCardProps {
  id: string;
  name: string;
  type: string;
  size: number;
  preview: string;
  charCount: number;
  uploadedAt: string;
  onDelete: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string, type: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["ts", "tsx", "js", "jsx"].includes(ext || "")) return "⚡";
  if (["py"].includes(ext || "")) return "🐍";
  if (["md"].includes(ext || "")) return "📝";
  if (["pdf"].includes(ext || "")) return "📄";
  if (["csv"].includes(ext || "")) return "📊";
  if (["json", "yaml", "yml"].includes(ext || "")) return "⚙️";
  if (["sql"].includes(ext || "")) return "🗄️";
  if (type.startsWith("image/")) return "🖼️";
  return "📁";
}

export function FileCard({
  id,
  name,
  type,
  size,
  preview,
  charCount,
  uploadedAt,
  onDelete,
}: FileCardProps) {
  return (
    <div className="group relative border border-zinc-800 rounded-xl p-4 bg-zinc-950
                    hover:border-zinc-600 transition-all duration-200">

      {/* Delete button */}
      <button
        onClick={() => onDelete(id)}
        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-zinc-800
                   text-zinc-500 hover:bg-red-500/20 hover:text-red-400
                   opacity-0 group-hover:opacity-100 transition-all text-xs
                   flex items-center justify-center"
      >
        ✕
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">{fileIcon(name, type)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate pr-6">{name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {formatSize(size)} · {charCount.toLocaleString()} chars extracted
          </p>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3 mb-3">
          {preview}...
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">
          {new Date(uploadedAt).toLocaleDateString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
          Sam can read this
        </span>
      </div>
    </div>
  );
}