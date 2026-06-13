/**
 * SammyOS — Vault Store
 * File: apps/desktop/lib/vault-store.ts
 *
 * UPDATED: Added `getById(id)` method used by /api/vault/content route.
 * Everything else identical to original.
 */

import "server-only";
import fs from "fs";
import path from "path";

export interface VaultFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  uploadedAt: Date;
  preview: string;
}

const STORE_PATH = path.join(process.cwd(), ".vault-store.json");

function loadFromDisk(): Map<string, VaultFile> {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      const entries: [string, VaultFile][] = JSON.parse(raw);
      // Re-parse dates
      return new Map(
        entries.map(([k, v]) => [k, { ...v, uploadedAt: new Date(v.uploadedAt) }])
      );
    }
  } catch (err) {
    console.warn("Could not load vault store:", err);
  }
  return new Map();
}

function saveToDisk(store: Map<string, VaultFile>) {
  try {
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify(Array.from(store.entries()), null, 2),
      "utf-8"
    );
  } catch (err) {
    console.warn("Could not save vault store:", err);
  }
}

const store = loadFromDisk();

export const VaultStore = {
  add(file: VaultFile) {
    store.set(file.id, file);
    saveToDisk(store);
  },

  getById(id: string): VaultFile | undefined {
    return store.get(id);
  },

  delete(id: string): boolean {
    const deleted = store.delete(id);
    if (deleted) saveToDisk(store);
    return deleted;
  },

  getAll(): Omit<VaultFile, "content">[] {
    return Array.from(store.values())
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .map(({ content: _, ...rest }) => rest); // omit content from list
  },

  /**
   * Returns context string injected into Sam's system prompt on every chat.
   * Limits each file to 4000 chars to stay within token budget.
   */
  getContext(): string {
    const files = Array.from(store.values());
    if (files.length === 0) return "";
    const parts = files.map((f) => {
      const snippet = f.content.slice(0, 4000);
      const truncated = f.content.length > 4000 ? "\n\n[...truncated...]" : "";
      return `=== FILE: ${f.name} (${f.type}) ===\n${snippet}${truncated}\n=== END: ${f.name} ===`;
    });
    return `\n\n--- KNOWLEDGE VAULT ---\n${parts.join("\n\n")}\n--- END VAULT ---`;
  },
};