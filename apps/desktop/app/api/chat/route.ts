import { VaultStore } from "@/lib/vault-store";
import { getProviderConfig } from "@/lib/provider-config";
import { injectUserKeys } from "./key-injection";

// ─────────────────────────────────────────────────────────────────────────────
// Vault injection heuristic
// ─────────────────────────────────────────────────────────────────────────────
function shouldInjectVault(message: string, historyLength: number): boolean {
  if (historyLength === 0) return true;
  const lower = message.toLowerCase();
  const vaultKeywords = [
    "file", "vault", "upload", "document", "code", "codebase", "report",
    "research", "folder", "summary", "readme", "function", "class", "import",
    "error", "bug", "fix", "implement", "where", "how does", "what does",
    "show me", "find", "look at", "check", "open", "read",
  ];
  return vaultKeywords.some((kw) => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Web search heuristic
// ─────────────────────────────────────────────────────────────────────────────
function shouldSearch(message: string, historyLength: number): boolean {
  const lower = message.toLowerCase();

  if (lower.includes("look up") || lower.includes("search for") || lower.includes("find out")) {
    return true;
  }

  const searchKeywords = [
    "who is", "who was", "who are", "what is", "what are", "what was",
    "when did", "when was", "how many", "how much", "where is", "where was",
    "tell me about", "do you know", "season", "episode", "movie", "show",
    "series", "game", "album", "song", "band", "actor", "actress", "director",
    "netflix", "hulu", "disney", "amazon", "villain", "character", "cast",
    "anime", "manga", "comic", "book", "author", "release", "plot", "story",
    "news", "latest", "recent", "current", "today", "this year", "2024", "2025", "2026",
  ];

  if (searchKeywords.some((kw) => lower.includes(kw))) return true;

  if (historyLength > 0) {
    const followUpTriggers = [
      "villain", "character", "season", "episode", "who", "when", "how many",
      "main", "plot", "ending", "cast", "voice", "actor", "based on", "what about",
      "what was", "first", "second", "third", "last", "final", "antagonist",
    ];
    return followUpTriggers.some((kw) => lower.includes(kw));
  }

  return false;
}

function extractTopic(history: HistoryMessage[]): string {
  const userMessages = history
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => m.content);

  if (userMessages.length === 0) return "";

  const multiWordRe = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})\b/g;

  const phraseOccurrences: Record<string, number> = {};
  for (const msg of userMessages) {
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = multiWordRe.exec(msg)) !== null) {
      const p = m[1].toLowerCase();
      if (!seen.has(p)) {
        phraseOccurrences[p] = (phraseOccurrences[p] ?? 0) + 1;
        seen.add(p);
      }
    }
  }

  const lastMsg = (userMessages[userMessages.length - 1] ?? "").toLowerCase();

  const candidates = Object.entries(phraseOccurrences)
    .filter(([phrase]) => {
      return (phraseOccurrences[phrase] ?? 0) >= 2 || lastMsg.includes(phrase);
    })
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase);

  return candidates[0] ?? "";
}

function buildSearchQuery(message: string, history: HistoryMessage[]): string {
  if (history.length === 0) return message;

  const topic = extractTopic(history);

  if (!topic || message.toLowerCase().includes(topic.toLowerCase())) {
    return message;
  }

  return `${topic} ${message}`.trim();
}

function checkResultRelevance(results: string, topic: string): boolean {
  if (!topic || !results) return true;
  const topicWords = topic.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const resultsLower = results.toLowerCase();
  const matchCount = topicWords.filter((w) => resultsLower.includes(w)).length;
  return matchCount >= Math.ceil(topicWords.length / 2);
}

function simplifyQuery(query: string): string {
  const stopWords = new Set([
    "who", "is", "are", "was", "were", "the", "a", "an", "in", "of", "for",
    "to", "do", "does", "did", "what", "where", "when", "how", "tell", "me",
    "about", "give", "can", "you", "your", "their", "its", "first", "second",
    "third", "last", "main", "primary",
  ]);
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
  return [...new Set(words)].slice(0, 6).join(" ");
}

async function ddgSearch(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SammyOS/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";

    const html = await res.text();

    const snippets: string[] = [];
    const snippetRe = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    const titleRe = /<a class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;

    const titles: string[] = [];
    let tm: RegExpExecArray | null;
    while ((tm = titleRe.exec(html)) !== null && titles.length < 6) {
      titles.push(tm[1].replace(/<[^>]+>/g, "").trim());
    }

    let sm: RegExpExecArray | null;
    let i = 0;
    while ((sm = snippetRe.exec(html)) !== null && snippets.length < 5) {
      const text = sm[1].replace(/<[^>]+>/g, "").trim();
      if (text.length > 30) {
        const title = titles[i] ?? "";
        snippets.push(title ? `• ${title}: ${text}` : `• ${text}`);
      }
      i++;
    }

    return snippets.join("\n");
  } catch {
    return "";
  }
}

async function braveSearch(query: string, braveKey?: string): Promise<string> {
  const apiKey = braveKey || process.env.BRAVE_API_KEY;
  if (!apiKey) return "";

  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=false`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return "";

    const data = await res.json();
    const results: string[] = [];

    const infobox = data?.infobox?.results?.[0];
    if (infobox?.description) {
      results.unshift(`[Infobox] ${infobox.title ?? ""}: ${infobox.description}`);
    }

    for (const r of data?.web?.results?.slice(0, 5) ?? []) {
      if (r.title && r.description) {
        results.push(`• ${r.title}: ${r.description}`);
      }
    }

    return results.join("\n");
  } catch {
    return "";
  }
}

async function webSearch(query: string, braveKey?: string): Promise<string> {
  let results = await braveSearch(query, braveKey);
  if (!results) results = await ddgSearch(query);
  if (results) return results;

  const simpleQuery = simplifyQuery(query);
  if (simpleQuery && simpleQuery !== query.toLowerCase().trim()) {
    results = await braveSearch(simpleQuery, braveKey);
    if (!results) results = await ddgSearch(simpleQuery);
  }

  return results;
}

const SYSTEM_PROMPT = (vaultContext: string, searchResults: string, searchWasRun: boolean) => `
You are Sam — a sharp, knowledgeable AI assistant built into Sammy OS. You speak with confidence and precision. Your tone is intelligent but natural: think brilliant colleague, not corporate chatbot.

RESPONSE QUALITY RULES:
- Lead with the answer. Never open with "Great question!" or filler phrases.
- Be specific and complete. Vague answers like "there are several reasons" without listing them are not acceptable.
- Use markdown formatting to organize responses — **bold** key terms and names, use bullet points for lists, use \`code\` for technical items.
- For multi-part questions, give each part its own clear line or bullet. Never run everything into one dense paragraph.
- Match length to complexity. A simple factual question gets 1–3 sentences. A detailed question gets a properly structured answer with sections.
- End with a natural follow-up offer only when genuinely relevant — not as a filler closing line.

ACCURACY RULES — follow these strictly:
1. If web search results are provided below, base your answer ON THOSE RESULTS ONLY. Do not blend in training-data guesses. Cite from the search results directly.
2. If a web search ran but returned nothing, say: "I searched but couldn't find reliable information on that — try rephrasing or ask me to search again." Do NOT fill in gaps with guesses on pop-culture facts, show/character details, release dates, etc.
3. If no search ran and the question involves a show, movie, game, character, villain, plot point, or any recent fact — say you're not certain and offer to search rather than guessing confidently.
4. On follow-up questions, answer from the current conversation context first, then search results, then vault files — in that priority order.

FORMATTING GUIDE:
- **Bold** for proper nouns, names, titles, and key terms
- *Italic* for emphasis or secondary context
- \`code\` for file names, commands, technical terms
- Bullet points (- item) for any list of 2+ things
- Short paragraph breaks between distinct points — never one giant wall of text

${searchResults ? `
--- WEB SEARCH RESULTS ---
${searchResults}
--- END OF SEARCH RESULTS ---
` : searchWasRun ? `
[Search ran but returned no results — do not guess; follow accuracy rule 2 above]
` : ""}

${vaultContext ? `
--- VAULT FILES ---
${vaultContext}
--- END OF VAULT CONTEXT ---
` : ""}
`;

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  imageBase64?: string;
}

async function callOllama(
  systemPrompt: string,
  priorMessages: HistoryMessage[],
  userMessage: string,
  model: string,
  ollamaUrl: string
): Promise<string> {
  const messages = [
    { role: "system", content: systemPrompt },
    ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message?.content ?? "";
}

export async function POST(req: Request) {
  try {
    // ── Key injection ────────────────────────────────────────────────────────
    const userToken = req.headers.get("x-sammy-token") ?? "";
    const userKeys = await injectUserKeys(userToken);
    console.log("USER KEYS RECEIVED:", JSON.stringify(userKeys));
console.log("TOKEN:", userToken ? "present" : "missing");

    const {
      message,
      imageBase64,
      history = [],
    }: {
      message: string;
      imageBase64?: string;
      history?: HistoryMessage[];
    } = await req.json();

    const recentHistory: HistoryMessage[] = history.slice(-10);

    const vaultContext = shouldInjectVault(message, recentHistory.length)
      ? VaultStore.getContext()
      : "";

    let searchResults = "";
    let searchWasRun = false;
    let resultsAreOffTopic = false;
    const activeTopic = extractTopic(recentHistory);

    if (shouldSearch(message, recentHistory.length)) {
      searchWasRun = true;
      const query = buildSearchQuery(message, recentHistory);
      searchResults = await webSearch(query, userKeys.BRAVE_API_KEY);
      if (searchResults && activeTopic) {
        resultsAreOffTopic = !checkResultRelevance(searchResults, activeTopic);
        if (resultsAreOffTopic) {
          const topicQuery = `${activeTopic} ${simplifyQuery(message)}`.trim();
          const retryResults = await webSearch(topicQuery, userKeys.BRAVE_API_KEY);
          if (retryResults && checkResultRelevance(retryResults, activeTopic)) {
            searchResults = retryResults;
            resultsAreOffTopic = false;
          }
          if (resultsAreOffTopic) searchResults = "";
        }
      }
    }

    const systemPrompt = SYSTEM_PROMPT(vaultContext, searchResults, searchWasRun);
    const config = getProviderConfig();

    // ── Ollama ───────────────────────────────────────────────────────────────
    if (config.useOllama) {
      try {
        const reply = await callOllama(
          systemPrompt,
          recentHistory,
          message,
          config.model,
          config.ollamaUrl
        );
        if (reply) return Response.json({ reply, provider: "ollama" });
      } catch (err) {
        console.warn("Ollama failed, falling back:", err);
      }
    }

    const userContent: any[] = [{ type: "text", text: message }];
    if (imageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" },
      });
    }

    const priorMessages = recentHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // ── Custom user API key (OpenAI-compatible OR Anthropic) ─────────────────
    const customKey = userKeys.CUSTOM_API_KEY;
    const customUrl = userKeys.CUSTOM_API_URL;
    if (customKey && customUrl) {
      const isAnthropic = customUrl.includes("anthropic");
      try {
        let reply: string | undefined;

        if (isAnthropic) {
          // Anthropic uses /v1/messages, not /chat/completions
          const customRes = await fetch(`${customUrl}/messages`, {
            method: "POST",
            headers: {
              "x-api-key": customKey,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5",
              max_tokens: 1024,
              system: systemPrompt,
              messages: [
                ...priorMessages,
                { role: "user", content: message },
              ],
            }),
          });
          if (!customRes.ok) throw new Error(`Anthropic custom ${customRes.status}`);
          const customData = await customRes.json();
          reply = customData.content?.[0]?.text;
        } else {
          // OpenAI-compatible (OpenAI, etc.)
          const customRes = await fetch(`${customUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${customKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                ...priorMessages,
                { role: "user", content: userContent },
              ],
              max_tokens: 1024,
            }),
          });
          if (!customRes.ok) throw new Error(`Custom API ${customRes.status}`);
          const customData = await customRes.json();
          reply = customData.choices?.[0]?.message?.content;
        }

        if (reply) return Response.json({ reply, provider: "custom" });
      } catch (err) { console.warn("Custom API failed, falling back:", err); }
    }

    // ── Groq ─────────────────────────────────────────────────────────────────
    const groqKey = userKeys.GROQ_API_KEY || process.env.GROQ_API_KEY;
    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [
            { role: "system", content: systemPrompt },
            ...priorMessages,
            { role: "user", content: userContent },
          ],
          max_tokens: 1024,
        }),
      });
      if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`);
      const groqData = await groqRes.json();
      return Response.json({
        reply: groqData.choices[0].message.content,
        provider: "groq",
      });
    } catch (err) {
      console.warn("Groq failed:", err);
    }

    // ── Gemini ────────────────────────────────────────────────────────────────
    const geminiKey = userKeys.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    try {
      const geminiContents: any[] = [];
      for (const m of recentHistory) {
        geminiContents.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        });
      }
      geminiContents.push({
        role: "user",
        parts: [
          { text: message },
          ...(imageBase64
            ? [{ inline_data: { mime_type: "image/jpeg", data: imageBase64 } }]
            : []),
        ],
      });

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: geminiContents,
          }),
        }
      );
      if (!geminiRes.ok) throw new Error(`Gemini ${geminiRes.status}`);
      const geminiData = await geminiRes.json();
      const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return Response.json({ reply, provider: "gemini" });
    } catch (err) {
      console.warn("Gemini failed:", err);
    }

    // ── Cerebras ──────────────────────────────────────────────────────────────
    const cerebrasKey = userKeys.CEREBRAS_API_KEY || process.env.CEREBRAS_API_KEY;
    try {
      const cerebrasRes = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cerebrasKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-4-scout-17b-16e-instruct",
          messages: [
            { role: "system", content: systemPrompt },
            ...priorMessages,
            { role: "user", content: message },
          ],
          max_tokens: 1024,
        }),
      });
      if (!cerebrasRes.ok) throw new Error(`Cerebras ${cerebrasRes.status}`);
      const cerebrasData = await cerebrasRes.json();
      return Response.json({
        reply: cerebrasData.choices[0].message.content,
        provider: "cerebras",
      });
    } catch (err) {
      console.warn("Cerebras failed:", err);
    }

    return Response.json({ reply: "Sam is unavailable right now." });
  } catch (err: any) {
    console.error("CHAT ROUTE CRASH:", err?.message, err?.stack);
    return Response.json({ reply: `DEBUG: ${err?.message}` }, { status: 500 });
  }
}