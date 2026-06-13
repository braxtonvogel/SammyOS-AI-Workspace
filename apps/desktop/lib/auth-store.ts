"use client";
import { create } from "zustand";

const BACKEND =
  process.env.NEXT_PUBLIC_NEXUS_ANALYZER_URL ??
  "https://nexus-analyzer-three.vercel.app";

const STORAGE_KEY = "sammy_auth";

export interface AuthUser {
  userId: string;
  email: string;
  token: string;
  apiKeys: Record<string, string>;
}

interface AuthStore {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    email: string,
    password: string,
    apiKeys: Record<string, string>
  ) => Promise<boolean>;
  logout: () => void;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

function persist(user: AuthUser) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}

function loadPersisted(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function fetchKeys(token: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${BACKEND}/api/auth/keys`, {
      headers: { "x-sammy-token": token },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.keys ?? {};
  } catch {
    return {};
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  hydrate: async () => {
    const persisted = loadPersisted();
    if (!persisted?.token) return;

    // Show cached user immediately so the app isn't blocked
    set({ user: persisted });

    // Then silently refresh keys in background
    const keys = await fetchKeys(persisted.token);

    if (Object.keys(keys).length === 0) {
      // Empty means either offline or token expired
      // Only clear if we got a definitive 401 — fetchKeys swallows errors
      // so we keep the cached user to stay offline-friendly
      return;
    }

    const updated = { ...persisted, apiKeys: keys };
    persist(updated);
    set({ user: updated });
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${BACKEND}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error ?? "Login failed", loading: false });
        return false;
      }

      // Login response already returns apiKeys from the server
      const keys = data.apiKeys ?? {};

      // Also do a fresh GET to make sure we have the latest
      const freshKeys = await fetchKeys(data.token);
      const finalKeys = Object.keys(freshKeys).length > 0 ? freshKeys : keys;

      const user: AuthUser = {
        userId: data.userId,
        email: data.email,
        token: data.token,
        apiKeys: finalKeys,
      };
      persist(user);
      set({ user, loading: false });
      return true;
    } catch {
      set({ error: "Cannot connect to server", loading: false });
      return false;
    }
  },

  register: async (email, password, apiKeys) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${BACKEND}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, apiKeys }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error ?? "Registration failed", loading: false });
        return false;
      }

      const user: AuthUser = {
        userId: data.userId,
        email: data.email,
        token: data.token,
        apiKeys,
      };
      persist(user);
      set({ user, loading: false });
      return true;
    } catch {
      set({ error: "Cannot connect to server", loading: false });
      return false;
    }
  },

  logout: () => {
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    set({ user: null });
  },
}));