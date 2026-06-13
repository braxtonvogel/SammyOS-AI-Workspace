/**
 * SammyOS — Ollama Connection Check
 * File: apps/desktop/app/api/settings/ollama-check/route.ts
 */

export async function POST(req: Request) {
  const { url } = await req.json();
  if (!url) return Response.json({ ok: false, error: "url required" });

  try {
    const res = await fetch(`${url}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return Response.json({ ok: false, error: `Ollama returned ${res.status}` });
    const data = await res.json();
    const models = (data.models ?? []).map((m: any) => ({
      name: m.name,
      size: m.size ?? 0,
      modified_at: m.modified_at ?? "",
    }));
    return Response.json({ ok: true, models });
  } catch (err: any) {
    return Response.json({
      ok: false,
      error: err.message?.includes("timeout")
        ? "Timed out — is Ollama running? Try: ollama serve"
        : "Connection failed — make sure Ollama is running",
    });
  }
}