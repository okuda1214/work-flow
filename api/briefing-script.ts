import { GoogleGenAI } from "@google/genai";

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

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { username = "あなた", tasks = [], calendarEvents = [] } = getBody(req);

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
    }

    const activeTasks = Array.isArray(tasks)
      ? tasks.filter((task: any) => task?.status !== "completed")
      : [];

    const taskLines = activeTasks
      .slice(0, 8)
      .map((task: any, index: number) => {
        return `${index + 1}. ${task?.title || "無題のタスク"} / 優先度:${task?.priority || "medium"} / 目安:${task?.estimatedMinutes || 30}分`;
      })
      .join("\n") || "未完了タスクはありません。";

    const eventLines = Array.isArray(calendarEvents)
      ? calendarEvents
          .slice(0, 5)
          .map((event: any, index: number) => `${index + 1}. ${event?.summary || "予定"}`)
          .join("\n")
      : "";

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const systemInstruction = `あなたは個人用の朝の音声ブリーフィングを作るアシスタントです。
以下の条件を必ず守ってください。
・日本語の自然な話し言葉にする
・30〜45秒で読める長さにする
・タスクをすべて読み上げず、重要そうなものを2〜3個だけ選ぶ
・予定は最大3件まで触れる
・不安をあおらず、やさしく前向きにする
・箇条書きではなく、音声で読みやすい文章にする
・読み上げ本文だけを返す`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `ユーザー名: ${username}

未完了タスク:
${taskLines}

今日の予定:
${eventLines || "予定はありません。"}`,
      config: {
        systemInstruction,
      },
    });

    const script = (response.text || "").trim();

    if (!script) {
      return res.status(500).json({ error: "No briefing script generated." });
    }

    return res.status(200).json({ script });
  } catch (error: any) {
    console.error("Error generating briefing script:", error);
    return res.status(500).json({ error: error.message || "Failed to generate briefing script." });
  }
}
