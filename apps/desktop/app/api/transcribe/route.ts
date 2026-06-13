export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get("audio") as Blob;

    if (!audioBlob) {
      return Response.json({ transcript: "" });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("Missing OPENROUTER_API_KEY");
    }

    // Convert blob to base64 for API
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    // Use OpenAI Whisper via direct API
    // This is free via your own local whisper or via Groq (free tier)
    // Groq gives free Whisper transcription - add GROQ_API_KEY to .env.local
    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: (() => {
          const fd = new FormData();
          fd.append(
            "file",
            new Blob([Buffer.from(base64Audio, "base64")], {
              type: "audio/webm",
            }),
            "audio.webm"
          );
          fd.append("model", "whisper-large-v3");
          return fd;
        })(),
      }
    );

    const result = await response.json();

    return Response.json({
      transcript: result.text || "",
    });
  } catch (err: any) {
    console.error("Transcription error:", err);
    return Response.json({ transcript: "" });
  }
}