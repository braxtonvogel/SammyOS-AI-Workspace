/**
 * SammyOS Research — Delete Job
 * File: apps/desktop/app/api/research/delete/route.ts
 */

import { ResearchStore } from "@/lib/research-store";
import { VaultStore } from "@/lib/vault-store";

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const job = ResearchStore.get(jobId);
  if (job?.vaultFileId) {
    // Also remove from vault so Sam stops referencing it
    VaultStore.delete(job.vaultFileId);
  }

  ResearchStore.delete(jobId);
  return Response.json({ ok: true });
}