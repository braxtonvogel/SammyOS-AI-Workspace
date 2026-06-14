const NEXUS_URL = process.env.NEXUS_ANALYZER_URL;
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
  if (!NEXUS_URL || !token) return {};
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
    if (!res.ok) return {};
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
  } catch {
    return {};
  }
}