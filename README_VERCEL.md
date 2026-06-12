# Vercelデプロイ用メモ

このフォルダは、AI Studioで作成された React/Vite + Express 構成のアプリを、GitHub + Vercelで公開しやすい形に直したものです。

## 変更したこと

- `server.ts` のAPI処理を Vercel Functions 用に分割
  - `api/parse-tasks.ts`
  - `api/tts.ts`
- `package.json` の `build` を `vite build` に変更
- SPA表示用に `vercel.json` を追加

## GitHubへアップする前の注意

`.env` や `.env.local` は絶対にGitHubへ上げないでください。  
Gemini APIキーはVercelの環境変数に登録します。

## Vercelで必要な環境変数

Vercelの Project Settings > Environment Variables で以下を追加してください。

```txt
GEMINI_API_KEY=あなたのGemini APIキー
```

## Vercelの設定

基本はVercelが自動検出します。

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

## ローカルでの確認

画面だけ確認する場合:

```bash
npm install
npm run dev
```

APIも含めて本番に近く確認する場合は、Vercel CLIを使います。

```bash
npm install
npx vercel dev
```

## Googleログイン・カレンダー連携について

このアプリはFirebase AuthとGoogle Calendar APIを使っています。  
Vercelで公開したURLをFirebase Authenticationの承認済みドメインに追加してください。

例:

```txt
your-project.vercel.app
```

独自ドメインを使う場合は、そのドメインも追加してください。
