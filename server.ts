import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client on the server
// The API key is fetched via process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// API endpoint for parsing raw task lists into structured format
app.post("/api/parse-tasks", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required and must be a string." });
    }

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
    res.json({ tasks: parsedData });
  } catch (error: any) {
    console.error("Error parsing tasks with Gemini:", error);
    res.status(500).json({ error: error.message || "Failed to parse tasks." });
  }
});

// API endpoint for generating voice briefing reading using Gemini TTS
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice = "Kore" } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required and must be a string." });
    }

    // Call gemini-3.1-flash-tts-preview
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say naturally: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: "No audio generated from TTS model." });
    }

    res.json({ audioBase64: base64Audio });
  } catch (error: any) {
    console.error("Error generating voice briefing via Gemini TTS:", error);
    res.status(500).json({ error: error.message || "Failed to generate TTS." });
  }
});

// Setup dev server vs production static serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer();
