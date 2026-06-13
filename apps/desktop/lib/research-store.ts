/**
 * SammyOS Research — Local Persistent Store
 * File: apps/desktop/lib/research-store.ts
 *
 * Same pattern as vault-store.ts: in-memory Map backed by JSON on disk.
 * Survives server restarts. Server-side only.
 */

import "server-only";
import fs from "fs";
import path from "path";

export interface ResearchJob {
  id: string;
  topic: string;
  status: "queued" | "researching" | "waiting_tokens" | "complete" | "failed";
  progress: string;
  progressStep: number;
  progressTotal: number;
  result?: string;
  createdAt: number;
  completedAt?: number;
  savedToVault?: boolean;
  vaultFileId?: string;
}

const STORE_PATH = path.join(process.cwd(), ".research-store.json");

function loadFromDisk(): Map<string, ResearchJob> {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      const entries: [string, ResearchJob][] = JSON.parse(raw);
      return new Map(entries);
    }
  } catch (err) {
    console.warn("Could not load research store:", err);
  }
  return new Map();
}

function saveToDisk(store: Map<string, ResearchJob>) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(Array.from(store.entries()), null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save research store:", err);
  }
}

const store = loadFromDisk();

export const ResearchStore = {
  add(job: ResearchJob) {
    store.set(job.id, job);
    saveToDisk(store);
  },

  get(id: string): ResearchJob | undefined {
    return store.get(id);
  },

  update(id: string, updates: Partial<ResearchJob>) {
    const existing = store.get(id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    store.set(id, updated);
    saveToDisk(store);
  },

  delete(id: string): boolean {
    const deleted = store.delete(id);
    if (deleted) saveToDisk(store);
    return deleted;
  },

  getAll(): ResearchJob[] {
    return Array.from(store.values()).sort((a, b) => b.createdAt - a.createdAt);
  },

  getInProgress(): ResearchJob[] {
    return Array.from(store.values()).filter(
      (j) => j.status === "queued" || j.status === "researching" || j.status === "waiting_tokens"
    );
  },
};