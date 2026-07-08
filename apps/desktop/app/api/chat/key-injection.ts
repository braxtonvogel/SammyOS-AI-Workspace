// NEXUS_ANALYZER_URL is not sensitive — it's the same public backend URL
// already exposed client-side via NEXT_PUBLIC_NEXUS_ANALYZER_URL. Hardcoding
// a fallback here means anyone who clones this repo gets a working app
// without needing to set up .env.local themselves.
const NEXUS_URL = process.env.NEXUS_ANALYZER_URL || "https://nexus-analyzer-three.vercel.app";

// NOTE: NEXUS_SECRET / x-nexus-secret is currently NOT validated by the
// /api/auth/keys route on the backend — it's sent but has no effect today.
// Leaving it optional here rather than hardcoding it, since a hardcoded
// secret in a public repo isn't a real secret. If you add server-side
// validation for this header later, keep it env-only (never commit the
// real value) — that will require anyone self-hosting nexus-analyzer to
// set their own secret to match.
const NEXUS_SECRET = process.env.NEXUS_SECRET;

export interface UserKeys {
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  BRAVE_API_KEY?: string;
  CUSTOM_API_KEY?: string;
  CUSTOM_API_URL?: string;
}

export async function injectUserKeys(token: string): Promise<UserKeys> {
  if (!token) return {};
  try {
    const res = await fetch(`${NEXUS_URL}/api/auth/keys`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-sammy-token": token,
        "x-nexus-secret": NEXUS_SECRET ?? "",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`injectUserKeys: /api/auth/keys returned ${res.status}`);
      return {};
    }
    const data = await res.json();
    const keys: UserKeys = data.keys ?? {};

    // Also inject into process.env for any code that reads env directly
    if (keys.GROQ_API_KEY)     process.env.GROQ_API_KEY     = keys.GROQ_API_KEY;
    if (keys.GEMINI_API_KEY)   process.env.GEMINI_API_KEY   = keys.GEMINI_API_KEY;
    if (keys.CEREBRAS_API_KEY) process.env.CEREBRAS_API_KEY = keys.CEREBRAS_API_KEY;
    if (keys.BRAVE_API_KEY)    process.env.BRAVE_API_KEY    = keys.BRAVE_API_KEY;
    if (keys.CUSTOM_API_KEY)   process.env.CUSTOM_API_KEY   = keys.CUSTOM_API_KEY;
    if (keys.CUSTOM_API_URL)   process.env.CUSTOM_API_URL   = keys.CUSTOM_API_URL;

    return keys;
  } catch (err) {
    console.warn("injectUserKeys failed:", err);
    return {};
  }
}