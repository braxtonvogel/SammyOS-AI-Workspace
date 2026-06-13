import { PendingJobs } from "@/lib/pending-jobs";

export async function GET() {
  const jobs = PendingJobs.getAll();
  return Response.json({ jobs });
}

export async function POST(req: Request) {
  const { jobId, folderName } = await req.json();
  if (!jobId) return Response.json({ error: "No jobId" }, { status: 400 });
  PendingJobs.add(jobId, folderName || "project");
  return Response.json({ success: true });
}

export async function DELETE(req: Request) {
  const { jobId } = await req.json();
  if (!jobId) return Response.json({ error: "No jobId" }, { status: 400 });
  PendingJobs.remove(jobId);
  return Response.json({ success: true });
}