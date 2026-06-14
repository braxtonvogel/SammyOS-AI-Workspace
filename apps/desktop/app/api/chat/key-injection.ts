const NEXUS_URL = process.env.NEXUS_ANALYZER_URL;
const NEXUS_SECRET = process.env.NEXUS_SECRET;

export interface InjectedKeys {
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  BRAVE_API_KEY?: string;
  CUSTOM_API_KEY?: string;
  CUSTOM_API_URL?: string;
}

export async function injectUserKeys(token: string): Promise<InjectedKeys> {
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
    return data.keys ?? {};
  } catch {
    return {};
  }
}