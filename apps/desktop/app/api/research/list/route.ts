/**
 * SammyOS Research — List Jobs
 * File: apps/desktop/app/api/research/list/route.ts
 */

import { ResearchStore } from "@/lib/research-store";

export async function GET() {
  const jobs = ResearchStore.getAll();
  return Response.json({ jobs });
}