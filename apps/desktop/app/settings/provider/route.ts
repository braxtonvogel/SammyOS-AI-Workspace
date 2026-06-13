/**
 * SammyOS — Provider Settings Route
 * File: apps/desktop/app/api/settings/provider/route.ts
 */

import { getProviderConfig, saveProviderConfig } from "@/lib/provider-config";

export function GET() {
  return Response.json(getProviderConfig());
}

export async function POST(req: Request) {
  const body = await req.json();
  saveProviderConfig({
    useOllama: body.useOllama ?? false,
    ollamaUrl: body.ollamaUrl ?? "http://localhost:11434",
    model: body.model ?? "llama3.1",
  });
  return Response.json({ ok: true });
}