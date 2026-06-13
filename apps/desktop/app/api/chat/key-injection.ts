// app/api/chat/key-injection.ts

const NEXUS_URL = process.env.NEXUS_ANALYZER_URL;
const NEXUS_SECRET = process.env.NEXUS_SECRET;

export async function injectUserKeys(token: string): Promise<void> {
  if (!NEXUS_URL || !token) return;
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
    if (!res.ok) return;
    const data = await res.json();
    if (data.keys) {
      if (data.keys.GROQ_API_KEY)     process.env.GROQ_API_KEY     = data.keys.GROQ_API_KEY;
      if (data.keys.GEMINI_API_KEY)   process.env.GEMINI_API_KEY   = data.keys.GEMINI_API_KEY;
      if (data.keys.CEREBRAS_API_KEY) process.env.CEREBRAS_API_KEY = data.keys.CEREBRAS_API_KEY;
      if (data.keys.BRAVE_API_KEY)    process.env.BRAVE_API_KEY    = data.keys.BRAVE_API_KEY;
      if (data.keys.CUSTOM_API_KEY)   process.env.CUSTOM_API_KEY   = data.keys.CUSTOM_API_KEY;
      if (data.keys.CUSTOM_API_URL)   process.env.CUSTOM_API_URL   = data.keys.CUSTOM_API_URL;
    }
  } catch {
    // Silently fail — app continues with shared keys if user keys unavailable
  }
}