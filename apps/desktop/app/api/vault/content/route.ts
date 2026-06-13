/**
 * SammyOS — Vault Content Route
 * File: apps/desktop/app/api/vault/content/route.ts
 *
 * Returns full file content by ID.
 * Vault list omits content for performance; viewer fetches this on demand.
 */

import { VaultStore } from "@/lib/vault-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const file = VaultStore.getById(id);
  if (!file) return Response.json({ error: "File not found" }, { status: 404 });

  return Response.json({ content: file.content });
}