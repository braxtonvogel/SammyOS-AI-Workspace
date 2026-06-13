/**
 * SammyOS — Vault Delete Route
 * File: apps/desktop/app/api/vault/delete/route.ts
 */

import { VaultStore } from "@/lib/vault-store";

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  VaultStore.delete(id);
  return Response.json({ ok: true });
}