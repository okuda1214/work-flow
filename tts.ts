import { GoogleGenAI, Type } from "@google/genai";

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
    const { text } = getBody(req);

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required and must be a string." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction =
      "You are an expert organizer. Parse the user's raw daily tasks list (which might be written as bullet points or free-text) " +
      "into a structured JSON array of tasks. " +
      "For each task, infer: " +
      "1. A clean, refined task title in Japanese. " +
      "2. A priority level ('high', 'medium', or 'low' based on importance/urgency terms). " +
      "3. Estimated duration in minutes (an integer, or 30 as a default if not mentioned). " +
      "4. A fit category (e.g., 'Work', 'Meeting', 'Email', 'Personal', 'Development', 'Planning'). " +
      "Make sure you preserve all tasks described in the input and translate any shorthand into fully formed text in Japanese.";

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Parse this daily task list into structured tasks:\n\n${text}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "Clean refined title of the task in Japanese.",
              },
              priority: {
                type: Type.STRING,
                description: "Priority level: must be high, medium, or low.",
              },
              estimatedMinutes: {
                type: Type.INTEGER,
                description: "Estimated duration in minutes (e.g. 15, 30, 60, 90).",
              },
              category: {
                type: Type.STRING,
                description: "Category of the task: Work, Meeting, Email, Personal, Learning, etc.",
              },
            },
            required: ["title", "priority", "estimatedMinutes", "category"],
          },
        },
      },
    });

    const parsedData = JSON.parse(response.text || "[]");
    return res.status(200).json({ tasks: parsedData });
  } catch (error: any) {
    console.error("Error parsing tasks with Gemini:", error);
    return res.status(500).json({ error: error.message || "Failed to parse tasks." });
  }
}
