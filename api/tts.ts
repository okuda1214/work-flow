export const config = {
  maxDuration: 30,
};

function getBody(req: any) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body || {};
}

function mapVoiceToOpenAI(voice: string) {
  const voiceMap: Record<string, string> = {
    Kore: "coral",
    Aoede: "sage",
    Puck: "echo",
    coral: "coral",
    sage: "sage",
    echo: "echo",
    nova: "nova",
    shimmer: "shimmer",
    alloy: "alloy",
  };
  return voiceMap[voice] || "coral";
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { text, voice = "coral" } = getBody(req);

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required and must be a string." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set." });
    }

    const openaiVoice = mapVoiceToOpenAI(voice);
    const ttsModel = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ttsModel,
        voice: openaiVoice,
        input: text,
        response_format: "mp3",
        instructions:
          "日本語で、落ち着いた朝のブリーフィングのように自然に話してください。早口になりすぎず、やさしく前向きなトーンにしてください。",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI TTS error:", errorText);
      return res.status(response.status).json({ error: errorText || "Failed to generate TTS." });
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

    return res.status(200).json({
      audioBase64,
      mimeType: "audio/mpeg",
    });
  } catch (error: any) {
    console.error("Error generating voice briefing via OpenAI TTS:", error);
    return res.status(500).json({ error: error.message || "Failed to generate TTS." });
  }
}
