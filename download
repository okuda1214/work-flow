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

function formatEventTime(event: any) {
  const value = event?.start?.dateTime || event?.start?.date;
  if (!value) return "時間未定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "時間未定";

  if (event?.start?.date) return "終日";
  return `${date.getHours()}時${String(date.getMinutes()).padStart(2, "0")}分`;
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

    const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const taskLines = activeTasks
      .sort((a: any, b: any) => (priorityRank[a?.priority] ?? 9) - (priorityRank[b?.priority] ?? 9))
      .slice(0, 8)
      .map((task: any, index: number) => {
        const priority = task?.priority === "high" ? "高" : task?.priority === "low" ? "低" : "中";
        return `${index + 1}. ${task?.title || "無題のタスク"} / 優先度:${priority} / 目安:${task?.estimatedMinutes || 30}分 / 状態:${task?.status || "未着手"}`;
      })
      .join("\n") || "未完了タスクはありません。";

    const eventLines = Array.isArray(calendarEvents)
      ? calendarEvents
          .sort((a: any, b: any) => {
            const aTime = new Date(a?.start?.dateTime || a?.start?.date || 0).getTime();
            const bTime = new Date(b?.start?.dateTime || b?.start?.date || 0).getTime();
            return aTime - bTime;
          })
          .slice(0, 5)
          .map((event: any, index: number) => `${index + 1}. ${formatEventTime(event)} ${event?.summary || "予定"}`)
          .join("\n")
      : "";

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction = `あなたは個人用の朝の音声ブリーフィングを作るアシスタントです。
以下の条件を必ず守ってください。
・日本語の自然な話し言葉にする
・30〜45秒で読める長さにする
・タスクをすべて読み上げず、重要そうなものを2〜3個だけ選ぶ
・予定は時間が近いもの、重要そうなものを中心に最大3件まで触れる
・不安をあおらず、やさしく前向きにする
・ビジネス文書っぽくしすぎない
・箇条書きではなく、音声で読みやすい文章にする
・余計な前置きや説明は入れず、読み上げ本文だけを返す`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `ユーザー名: ${username}\n\n未完了タスク:\n${taskLines}\n\n今日の予定:\n${eventLines || "予定はありません。"}`,
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
