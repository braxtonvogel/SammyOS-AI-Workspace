// lib/auth-store.ts
// Persists login token + user info to localStorage.
// On app start, if a token exists, silently fetch the latest API keys
// from the backend and inject them into the running environment.

import { create } from "zustand";

// The URL of your nexus-analyzer backend (same one you already have)
const BACKEND = process.env.NEXT_PUBLIC_NEXUS_ANALYZER_URL ?? "https://nexus-analyzer-three.vercel.app";

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
  register: (email: string, password: string, apiKeys: Record<string, string>) => Promise<boolean>;
  logout: () => void;
  updateKeys: (keys: Record<string, string>) => Promise<boolean>;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

function persist(user: AuthUser) {
  if (typeof window !== "undefined") {
    localStorage.setItem("sammy_auth", JSON.stringify(user));
  }
}

function loadPersisted(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("sammy_auth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  hydrate: async () => {
    const persisted = loadPersisted();
    if (!persisted?.token) return;

    // Silently refresh keys from backend on app start
    try {
      const res = await fetch(`${BACKEND}/api/auth/keys`, {
        headers: { "x-sammy-token": persisted.token },
      });
      if (res.ok) {
        const data = await res.json();
        const user = { ...persisted, apiKeys: data.apiKeys };
        persist(user);
        set({ user });
      } else {
        // Token expired — clear it
        localStorage.removeItem("sammy_auth");
      }
    } catch {
      // Network offline — use cached keys
      set({ user: persisted });
    }
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
      const user: AuthUser = {
        userId: data.userId,
        email: data.email,
        token: data.token,
        apiKeys: data.apiKeys ?? {},
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

  updateKeys: async (keys) => {
    const { user } = get();
    if (!user) return false;
    try {
      const res = await fetch(`${BACKEND}/api/auth/keys`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-sammy-token": user.token,
        },
        body: JSON.stringify({ apiKeys: keys }),
      });
      if (res.ok) {
        const updated = { ...user, apiKeys: keys };
        persist(updated);
        set({ user: updated });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  logout: () => {
    if (typeof window !== "undefined") localStorage.removeItem("sammy_auth");
    set({ user: null });
  },
}));