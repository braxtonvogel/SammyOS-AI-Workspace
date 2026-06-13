/**
 * SammyOS — Provider Config
 * File: apps/desktop/lib/provider-config.ts
 *
 * Shared by chat/route.ts and settings/provider/route.ts.
 * Keeping it in lib/ avoids Next.js circular import issues between route files.
 */

import "server-only";
import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), ".provider-config.json");

export interface ProviderConfig {
  useOllama: boolean;
  ollamaUrl: string;
  model: string;
}

const DEFAULT: ProviderConfig = {
  useOllama: false,
  ollamaUrl: "http://localhost:11434",
  model: "llama3.1",
};

export function getProviderConfig(): ProviderConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULT, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) };
    }
  } catch {}
  return DEFAULT;
}

export function saveProviderConfig(config: ProviderConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}