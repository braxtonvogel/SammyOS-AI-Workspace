import { VaultStore, VaultFile } from "@/lib/vault-store";
import { randomUUID } from "crypto";

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".css",
  ".html", ".json", ".md", ".txt", ".sql", ".yaml", ".yml",
  ".sh", ".xml", ".env", ".gitignore", ".prettierrc",
  ".eslintrc", ".toml", ".rs", ".go", ".rb", ".php",
  ".swift", ".kt", ".cs", ".cpp", ".c", ".h", ".ipynb",
  ".r", ".R", ".scala", ".vue", ".svelte",
]);

const IGNORED_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build",
  "__pycache__", ".venv", "venv", ".cache", "coverage",
  ".mypy_cache", ".pytest_cache", "eggs", ".eggs",
  "htmlcov", ".tox", ".hypothesis",
]);

function isTextFile(filename: string): boolean {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function isIgnoredPath(path: string): boolean {
  return path.split("/").some((part) => IGNORED_DIRS.has(part));
}

// Small delay between API calls to avoid rate limits
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Call AI with automatic Groq → Gemini fallback
async function callAI(prompt: string, maxTokens = 1024): Promise<string> {
  // Try Groq first
  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [
            {
              role: "system",
              content: "You are an expert software engineer analyzing codebases. Be concise and technical.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: maxTokens,
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content;
    }

    // Rate limited — wait and try Gemini
    if (res.status === 429) {
      console.log("⏳ Groq rate limited, switching to Gemini...");
      await sleep(1000);
    }
  } catch (err) {
    console.warn("Groq failed:", err);
  }

  // Gemini fallback
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
  } catch (err) {
    console.warn("Gemini failed:", err);
  }

  return "";
}

// Phase 1 — Summarize a single file
async function summarizeFile(
  path: string,
  content: string
): Promise<string> {
  // For very short files just return them directly — not worth an API call
  if (content.trim().length < 300) {
    return `File: ${path}\n${content}`;
  }

  const prompt = `Summarize this file concisely for a developer who needs to understand the codebase.
File: ${path}
Content:
${content.slice(0, 3000)}

Include:
- What this file does
- Key functions/classes/components and their purpose
- Important dependencies or imports
- Any notable patterns or logic

Keep it under 200 words.`;

  const summary = await callAI(prompt, 512);
  return `## ${path}\n${summary}`;
}

// Phase 2 — Summarize a group of related files (by folder/module)
async function summarizeGroup(
  groupName: string,
  fileSummaries: string[]
): Promise<string> {
  const combined = fileSummaries.join("\n\n");

  const prompt = `You are analyzing the "${groupName}" module of a software project.
Here are summaries of each file in this module:

${combined}

Write a module-level summary that explains:
- What this module/folder is responsible for
- How the files work together
- Key data flows or interactions within this module
- Important patterns or architecture decisions

Keep it under 300 words.`;

  const summary = await callAI(prompt, 768);
  return `# Module: ${groupName}\n${summary}`;
}

// Phase 3 — Generate master summary from all module summaries
async function generateMasterSummary(
  folderName: string,
  moduleSummaries: string[],
  allFilePaths: string[]
): Promise<string> {
  const combined = moduleSummaries.join("\n\n---\n\n");
  const fileTree = allFilePaths.join("\n");

  const prompt = `You are generating the master documentation for a software project called "${folderName}".

File structure:
${fileTree}

Module summaries:
${combined}

Generate a comprehensive CODEBASE_SUMMARY.md with these sections:

# ${folderName} — Complete Codebase Documentation

## Project Overview
What this project does, its purpose and goals.

## Tech Stack
All technologies, frameworks, libraries used.

## Architecture Overview
How the system is structured, major components and how they interact.

## Module Breakdown
Each major folder/module and its responsibility.

## Key Features & Implementation
For each major feature, explain what it does and exactly how it was implemented (file names, function names, data flow).

## Data Flow
How data moves through the system end to end.

## Setup & Entry Points
Where the app starts, how to run it, key configuration files.

## Patterns & Conventions
Any design patterns, naming conventions, or architectural decisions used consistently.

Be specific — reference actual file names, function names, and class names throughout.`;

  const summary = await callAI(prompt, 4096);
  return summary;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const folderName = formData.get("folderName") as string || "project";
    const files = formData.getAll("files") as File[];
    const paths = formData.getAll("paths") as string[];

    if (!files.length) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }

    const addedFiles: any[] = [];
    const fileContents: { path: string; content: string }[] = [];

    console.log(`📁 Folder upload: "${folderName}" — ${files.length} total files`);

    // Step 1 — Read and store all text files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = paths[i] || file.name;

      if (isIgnoredPath(relativePath) || !isTextFile(file.name)) continue;
      if (file.size > 500 * 1024) {
        console.log(`⏭ Skipping large file: ${relativePath}`);
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const content = new TextDecoder("utf-8").decode(arrayBuffer);

        const readableRatio =
          (content.match(/[\x20-\x7E\n\r\t]/g) || []).length / content.length;
        if (readableRatio < 0.6) continue;

        fileContents.push({ path: relativePath, content });

        // Store each file individually in vault
        const vaultFile: VaultFile = {
          id: randomUUID(),
          name: relativePath,
          type: "text/plain",
          size: file.size,
          content,
          uploadedAt: new Date(),
          preview: content.slice(0, 200).replace(/\n/g, " "),
        };

        VaultStore.add(vaultFile);
        addedFiles.push({
          id: vaultFile.id,
          name: vaultFile.name,
          type: vaultFile.type,
          size: vaultFile.size,
          preview: vaultFile.preview,
          charCount: content.length,
          uploadedAt: vaultFile.uploadedAt,
        });
      } catch (err) {
        console.warn(`Failed to read ${relativePath}:`, err);
      }
    }

    console.log(`✅ Read ${fileContents.length} files — starting hierarchical summarization`);

    if (fileContents.length === 0) {
      return Response.json({ error: "No readable files found" }, { status: 400 });
    }

    // Step 2 — Group files by top-level folder/module
    const groups = new Map<string, { path: string; content: string }[]>();

    for (const file of fileContents) {
      const parts = file.path.split("/");
      // Group by second segment (e.g. "src", "components", "api")
      // or "root" if file is at top level
      const groupKey = parts.length > 2 ? parts[1] : "root";
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(file);
    }

    console.log(`📦 ${groups.size} module groups identified:`, [...groups.keys()]);

    // Step 3 — Phase 1: Summarize each file individually
    // Process in batches of 5 to avoid rate limits
    const fileSummaries = new Map<string, string>();
    const allFiles = fileContents;
    const BATCH_SIZE = 5;

    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      const batch = allFiles.slice(i, i + BATCH_SIZE);
      console.log(`📄 Summarizing files ${i + 1}-${Math.min(i + BATCH_SIZE, allFiles.length)} of ${allFiles.length}`);

      const batchResults = await Promise.all(
        batch.map((f) => summarizeFile(f.path, f.content))
      );

      batch.forEach((f, idx) => {
        fileSummaries.set(f.path, batchResults[idx]);
      });

      // Small pause between batches to respect rate limits
      if (i + BATCH_SIZE < allFiles.length) await sleep(500);
    }

    // Step 4 — Phase 2: Summarize each module group
    const moduleSummaries: string[] = [];

    for (const [groupName, groupFiles] of groups) {
      console.log(`🗂 Summarizing module: ${groupName} (${groupFiles.length} files)`);

      const groupFileSummaries = groupFiles
        .map((f) => fileSummaries.get(f.path) || "")
        .filter(Boolean);

      // If only 1-2 files, skip group summary and use file summaries directly
      if (groupFileSummaries.length <= 2) {
        moduleSummaries.push(...groupFileSummaries);
      } else {
        const moduleSummary = await summarizeGroup(groupName, groupFileSummaries);
        moduleSummaries.push(moduleSummary);
      }

      await sleep(300);
    }

    // Step 5 — Phase 3: Generate master summary
    console.log("🧠 Generating master codebase summary...");
    const allFilePaths = fileContents.map((f) => f.path);
    const masterSummary = await generateMasterSummary(
      folderName,
      moduleSummaries,
      allFilePaths
    );

    // Store master summary in vault
    const summaryFile: VaultFile = {
      id: randomUUID(),
      name: `${folderName}/CODEBASE_SUMMARY.md`,
      type: "text/markdown",
      size: masterSummary.length,
      content: masterSummary,
      uploadedAt: new Date(),
      preview: masterSummary.slice(0, 200).replace(/\n/g, " "),
    };

    VaultStore.add(summaryFile);
    addedFiles.unshift({
      id: summaryFile.id,
      name: summaryFile.name,
      type: summaryFile.type,
      size: summaryFile.size,
      preview: summaryFile.preview,
      charCount: masterSummary.length,
      uploadedAt: summaryFile.uploadedAt,
    });

    console.log(`🎉 Folder "${folderName}" fully processed — ${fileContents.length} files + master summary`);

    return Response.json({
      success: true,
      files: addedFiles,
      fileCount: fileContents.length,
      folderName,
      summaryGenerated: true,
    });

  } catch (err: any) {
    console.error("Folder upload error:", err);
    return Response.json(
      { error: err.message || "Folder upload failed" },
      { status: 500 }
    );
  }
}