import * as v from "valibot"
import { env } from "../config/env.js"
import type { Command } from "../types/index.js"

// Gemini APIのエンドポイント
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`

// コマンドのValibotスキーマ
const CommandSchema = v.union([
  v.object({
    type: v.literal("add"),
    title: v.string(),
    dueDate: v.nullable(v.string()),
    assignee: v.nullable(v.string()),
    priority: v.nullable(v.number()),
  }),
  v.object({ type: v.literal("list") }),
  v.object({ type: v.literal("complete"), query: v.string() }),
  v.object({ type: v.literal("complete_select"), index: v.number() }),
  v.object({ type: v.literal("help") }),
])

// Gemini APIのレスポンス型
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

// システムプロンプト
const SYSTEM_PROMPT = `あなたはLINE Botのコマンドパーサーです。
ユーザーのメッセージを解析し、以下のJSON形式で返してください。
余分なテキストやマークダウンは一切出力せず、JSONのみを返してください。

コマンド種別:
- タスク追加: { "type": "add", "title": "タスク名", "dueDate": "YYYY-MM-DD or null", "assignee": "@alias or null", "priority": 1-4 or null }
- タスク一覧: { "type": "list" }
- タスク完了: { "type": "complete", "query": "識別子またはキーワード" }
- 番号選択（完了候補から選ぶ）: { "type": "complete_select", "index": 番号 }
- ヘルプ/不明: { "type": "help" }

優先度: 緊急=1, 高=2, 中=3, 低=4
日付の相対表現（「明日」「来週月曜」など）は今日の日付を基準にYYYY-MM-DDに変換すること。`

// Gemini 2.0 Flash を使ってメッセージをコマンドに解析する
export async function parseMessageWithGemini(message: string, today: string): Promise<Command> {
  const prompt = `今日の日付: ${today}\n\nユーザーメッセージ: ${message}`

  const response = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as GeminiResponse
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error("Gemini APIからレスポンスが得られませんでした")
  }

  // JSONをパースしてValibotでバリデーション
  const parsed = JSON.parse(text)
  const result = v.safeParse(CommandSchema, parsed)

  if (!result.success) {
    throw new Error(`コマンドの解析に失敗しました: ${JSON.stringify(result.issues)}`)
  }

  return result.output as Command
}
