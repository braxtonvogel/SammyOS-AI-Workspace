/**
 * SammyOS — Vault List Route
 * File: apps/desktop/app/api/vault/list/route.ts
 *
 * FIXED: content may be undefined (getAll() omits it for performance).
 * Uses f.content?.length ?? 0 instead of f.content.length.
 */

import { VaultStore } from "@/lib/vault-store";

export async function GET() {
  const files = VaultStore.getAll();
  return Response.json({
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      size: f.size,
      preview: f.preview,
      charCount: (f as any).content?.length ?? f.size,
      uploadedAt: f.uploadedAt,
    })),
  });
}