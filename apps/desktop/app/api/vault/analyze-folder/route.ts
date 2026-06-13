import "server-only";
import { VaultStore, VaultFile } from "@/lib/vault-store";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const ANALYZER_URL =
    process.env.NEXUS_ANALYZER_URL || "https://nexus-analyzer-three.vercel.app";
  const NEXUS_SECRET = process.env.NEXUS_SECRET || "";

  try {
    const body = await req.json();

    const res = await fetch(`${ANALYZER_URL}/api/jobs/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-nexus-secret": NEXUS_SECRET,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      return Response.json({ error: err.error }, { status: 400 });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err: any) {
    console.error("POST error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const ANALYZER_URL =
    process.env.NEXUS_ANALYZER_URL || "https://nexus-analyzer-three.vercel.app";
  const NEXUS_SECRET = process.env.NEXUS_SECRET || "";

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return Response.json({ error: "No jobId" }, { status: 400 });
  }

  try {
    const statusRes = await fetch(`${ANALYZER_URL}/api/jobs/${jobId}`, {
      headers: { "x-nexus-secret": NEXUS_SECRET },
    });

    const status = await statusRes.json();

    // If pending, kick off processing
    if (status.status === "pending") {
      fetch(`${ANALYZER_URL}/api/jobs/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nexus-secret": NEXUS_SECRET,
        },
        body: JSON.stringify({ jobId }),
      }).catch(() => {});
    }

    if (status.hasResult) {
      const downloadRes = await fetch(`${ANALYZER_URL}/api/jobs/${jobId}`, {
        method: "POST",
        headers: { "x-nexus-secret": NEXUS_SECRET },
      });

      const { result, folderName } = await downloadRes.json();

      const summaryFile: VaultFile = {
        id: randomUUID(),
        name: `${folderName || "project"}/CODEBASE_SUMMARY.md`,
        type: "text/markdown",
        size: result.length,
        content: result,
        uploadedAt: new Date(),
        preview: result.slice(0, 200).replace(/\n/g, " "),
      };

      VaultStore.add(summaryFile);

      return Response.json({
        status: "complete",
        summaryFile: {
          id: summaryFile.id,
          name: summaryFile.name,
          type: summaryFile.type,
          size: summaryFile.size,
          preview: summaryFile.preview,
          charCount: result.length,
          uploadedAt: summaryFile.uploadedAt,
        },
      });
    }

    return Response.json(status);
  } catch (err: any) {
    console.error("GET error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}