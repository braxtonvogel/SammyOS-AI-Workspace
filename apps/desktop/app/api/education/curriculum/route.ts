import { getProviderConfig } from "@/lib/provider-config";

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const config = getProviderConfig();

  // 1. Try Ollama if configured
  if (config.provider === "ollama") {
    try {
      const res = await fetch(`${config.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.ollamaModel,
          prompt: `${systemPrompt}\n\nUser: ${userMessage}`,
          stream: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.response;
      }
    } catch { /* fall through */ }
  }

  // 2. Try Groq
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1500,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content;
    }
  } catch { /* fall through */ }

  // 3. Fallback to Gemini
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
      }),
    }
  );
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Unable to generate curriculum.";
}

export async function POST(req: Request) {
  try {
    const { subject, level, goal } = await req.json();

    const systemPrompt = `You are an expert curriculum designer and educator inside SammyOS.
Generate structured learning curricula that are practical, progressive, and engaging.
Always respond with valid JSON only — no markdown fences, no preamble.`;

    const userMessage = `Create a learning curriculum for:
Subject: ${subject}
Skill Level: ${level}
Goal: ${goal}

Respond with this exact JSON structure:
{
  "title": "Learning ${subject}",
  "description": "One sentence describing this curriculum",
  "estimatedHours": <number>,
  "modules": [
    {
      "id": "m1",
      "title": "Module title",
      "description": "What this module covers",
      "topics": ["topic1", "topic2", "topic3"],
      "estimatedHours": <number>
    }
  ]
}

Generate 4-6 modules appropriate for a ${level} learner with the goal to ${goal}.
Keep topics concrete and actionable. For programming subjects include hands-on exercises.`;

    const raw = await callAI(systemPrompt, userMessage);

    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, "").trim();
    const curriculum = JSON.parse(clean);

    return Response.json({ curriculum });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}