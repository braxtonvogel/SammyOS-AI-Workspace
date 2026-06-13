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
        max_tokens: 300,
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
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Keep going — you're doing great!";
}

export async function POST(req: Request) {
  try {
    const { subject, level, currentTopic, completedTopics, screenContext } = await req.json();

    const systemPrompt = `You are Sam, the AI learning coach inside SammyOS.
Your role is to give SHORT, Socratic hints — never full answers.
One sentence max. Be encouraging but make the learner think.
Never say "I see" or "I notice". Just give the hint directly.`;

    const contextParts = [
      `Subject: ${subject}`,
      `Level: ${level}`,
      `Current topic: ${currentTopic}`,
      completedTopics?.length ? `Completed: ${completedTopics.join(", ")}` : "",
      screenContext ? `Screen context: ${screenContext}` : "",
    ].filter(Boolean).join("\n");

    const userMessage = `${contextParts}

Give one short Socratic hint to help the learner progress on "${currentTopic}".
Hint:`;

    const hint = await callAI(systemPrompt, userMessage);

    return Response.json({ hint: hint.trim() });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}