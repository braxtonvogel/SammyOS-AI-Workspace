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
    // Route returns { keys: {...} }
    const keys = data.keys ?? {};
    if (keys.GROQ_API_KEY)     process.env.GROQ_API_KEY     = keys.GROQ_API_KEY;
    if (keys.GEMINI_API_KEY)   process.env.GEMINI_API_KEY   = keys.GEMINI_API_KEY;
    if (keys.CEREBRAS_API_KEY) process.env.CEREBRAS_API_KEY = keys.CEREBRAS_API_KEY;
    if (keys.BRAVE_API_KEY)    process.env.BRAVE_API_KEY    = keys.BRAVE_API_KEY;
    if (keys.CUSTOM_API_KEY)   process.env.CUSTOM_API_KEY   = keys.CUSTOM_API_KEY;
    if (keys.CUSTOM_API_URL)   process.env.CUSTOM_API_URL   = keys.CUSTOM_API_URL;
  } catch {
    // Silently fail — falls through to shared free rotation keys
  }
}