import { getProviderConfig } from "@/lib/provider-config";

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const config = getProviderConfig();

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
        max_tokens: 2000,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content;
    }
  } catch { /* fall through */ }

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
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Unable to generate lesson.";
}

export async function POST(req: Request) {
  try {
    const { subject, level, moduleTitle, topic } = await req.json();

    const systemPrompt = `You are an expert educator inside SammyOS creating interactive lesson content.
Write lessons that are clear, practical, and appropriate for the given skill level.
Always respond with valid JSON only — no markdown fences, no preamble.`;

    const userMessage = `Create a complete lesson for:
Subject: ${subject}
Level: ${level}
Module: ${moduleTitle}
Topic: ${topic}

Respond with this exact JSON structure:
{
  "title": "${topic}",
  "explanation": "Clear explanation of the concept (2-4 paragraphs, use \\n\\n between paragraphs)",
  "example": {
    "description": "What this example demonstrates",
    "code": "The actual code or content example (use real newlines)",
    "language": "python|javascript|java|text|etc"
  },
  "practice": {
    "prompt": "A small exercise to practice this concept",
    "hint": "A helpful hint without giving the full answer"
  },
  "challenge": {
    "prompt": "A more difficult problem building on the practice",
    "hint": "A subtle hint"
  },
  "quiz": [
    {
      "question": "Quiz question",
      "options": ["A) option", "B) option", "C) option", "D) option"],
      "correct": 0
    }
  ]
}

Generate exactly 5 quiz questions. The correct field is the 0-based index of the right answer.
Make content appropriate for a ${level} learner.`;

    const raw = await callAI(systemPrompt, userMessage);
    const clean = raw.replace(/```json|```/g, "").trim();
    const lesson = JSON.parse(clean);

    return Response.json({ lesson });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}