import { GoogleGenerativeAI } from "@google/generative-ai";
import * as v from "valibot";
import { env } from "@/config/env";
import type { Command } from "@/domain/types";

// Geminiクライアントの初期化
const genai = new GoogleGenerativeAI(env.GEMINI_API_KEY);

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
]);

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
日付の相対表現（「明日」「来週月曜」など）は今日の日付を基準にYYYY-MM-DDに変換すること。`;

// Gemini SDK でメッセージをコマンドに解析する
export async function parseMessageWithGemini(message: string, today: string): Promise<Command> {
  const model = genai.getGenerativeModel({
    model: env.GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `今日の日付: ${today}\n\nユーザーメッセージ: ${message}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const parsed: unknown = JSON.parse(text);
  const validated = v.safeParse(CommandSchema, parsed);

  if (!validated.success) {
    throw new Error(`コマンドの解析に失敗しました: ${JSON.stringify(validated.issues)}`);
  }

  return validated.output as Command;
}
