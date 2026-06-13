/**
 * SammyOS Research — Start Job
 * File: apps/desktop/app/api/research/start/route.ts
 *
 * Receives a topic from the frontend, creates a research job in the
 * local research store, then fire-and-forgets the job to the
 * nexus-analyzer backend (which runs the actual multi-step AI research).
 */

import { ResearchStore } from "@/lib/research-store";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  try {
    const { topic } = await req.json();
    if (!topic?.trim()) {
      return Response.json({ error: "topic required" }, { status: 400 });
    }

    const jobId = randomUUID();

    // Create local job record immediately
    ResearchStore.add({
      id: jobId,
      topic: topic.trim(),
      status: "queued",
      progress: "Queued…",
      progressStep: 0,
      progressTotal: 10,
      createdAt: Date.now(),
    });

    // Fire-and-forget to nexus-analyzer backend
    // The backend will run multi-step research with token-wait-and-retry
    fireResearch(jobId, topic.trim()).catch((err) => {
      console.error("Research fire-and-forget error:", err);
      ResearchStore.update(jobId, { status: "failed", progress: "Failed to start." });
    });

    return Response.json({ jobId });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Fires the research job to nexus-analyzer.
 * nexus-analyzer handles the full multi-step AI research loop with
 * automatic token-wait-and-retry. SammyOS polls for status separately.
 */
async function fireResearch(jobId: string, topic: string) {
  const url = `${process.env.NEXUS_ANALYZER_URL}/api/research/start`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-nexus-secret": process.env.NEXUS_SECRET!,
    },
    body: JSON.stringify({ jobId, topic }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`nexus-analyzer responded ${res.status}: ${text}`);
  }

  ResearchStore.update(jobId, { status: "researching", progress: "Research started on backend…" });
}