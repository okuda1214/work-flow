# OpenAI音声版メモ

この版では、朝のブリーフィング音声について以下をOpenAI APIに切り替えています。

- `/api/briefing-script.ts`：タスクと予定から短い自然な台本を作成
- `/api/tts.ts`：台本をOpenAI TTSで音声化

## Vercelに追加する環境変数

Vercel → Project → Settings → Environment Variables に以下を追加してください。

```txt
OPENAI_API_KEY=自分のOpenAI APIキー
OPENAI_SCRIPT_MODEL=gpt-5.4-nano
OPENAI_TTS_MODEL=gpt-4o-mini-tts
```

`OPENAI_SCRIPT_MODEL` と `OPENAI_TTS_MODEL` は任意ですが、入れておくと後からモデルを変えやすいです。

## Gemini APIキーについて

`/api/parse-tasks.ts` はまだGeminiを使っています。タスク解析機能も使う場合は、これまで通り `GEMINI_API_KEY` もVercelに残してください。
