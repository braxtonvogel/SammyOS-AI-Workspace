import { VaultStore, VaultFile } from "@/lib/vault-store";
import { randomUUID } from "crypto";

// Supported file types and how to extract their text
async function extractText(
  file: File,
  arrayBuffer: ArrayBuffer
): Promise<string> {
  const type = file.type;
  const name = file.name.toLowerCase();

  // Images — Sam handles via vision in chat
  if (type.startsWith("image/")) {
    return `[Image file: ${file.name} — attach it in chat for Sam to analyze visually]`;
  }

  // PDFs — extract with unpdf
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    try {
      const { extractText } = await import("unpdf");
      const buffer = new Uint8Array(arrayBuffer);
      const { text } = await extractText(buffer, { mergePages: true });
      return text;
    } catch (err: any) {
      console.error("PDF extract error:", err?.message);
      return `[PDF parse failed: ${err?.message || "unknown error"}]`;
    }
  }

  // Everything else — try UTF-8 decode
  try {
    const decoder = new TextDecoder("utf-8");
    const text = decoder.decode(arrayBuffer);

    const readableRatio =
      (text.match(/[\x20-\x7E\n\r\t]/g) || []).length / text.length;

    if (readableRatio > 0.6) {
      return text;
    }

    return `[Binary file: ${file.name} — content not readable as text]`;
  } catch {
    return `[Could not extract content from ${file.name}]`;
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const content = await extractText(file, arrayBuffer);

    const vaultFile: VaultFile = {
      id: randomUUID(),
      name: file.name,
      type: file.type || "text/plain",
      size: file.size,
      content,
      uploadedAt: new Date(),
      preview: content.slice(0, 200).replace(/\n/g, " "),
    };

    VaultStore.add(vaultFile);

    console.log(`✅ Vault: added "${file.name}" (${content.length} chars extracted)`);

    return Response.json({
      success: true,
      file: {
        id: vaultFile.id,
        name: vaultFile.name,
        type: vaultFile.type,
        size: vaultFile.size,
        preview: vaultFile.preview,
        uploadedAt: vaultFile.uploadedAt,
        charCount: content.length,
      },
    });
  } catch (err: any) {
    console.error("Vault upload error:", err);
    return Response.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}