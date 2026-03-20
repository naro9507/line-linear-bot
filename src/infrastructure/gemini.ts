import { env } from "@/config/env";
import type { GeminiRepository } from "@/domain/repositories";
import type { Command } from "@/domain/types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as v from "valibot";

// Geminiクライアントの初期化
const genai = new GoogleGenerativeAI(env.GEMINI_API_KEY);

// コマンドのValibotスキーマ
const CommandSchema = v.union([
  v.object({ type: v.literal("add") }),
  v.object({ type: v.literal("list") }),
  v.object({ type: v.literal("complete"), query: v.string() }),
  v.object({ type: v.literal("complete_select"), index: v.number() }),
  v.object({ type: v.literal("update"), query: v.string() }),
  v.object({ type: v.literal("update_select"), index: v.number() }),
  v.object({ type: v.literal("help") }),
]);

// システムプロンプト
const SYSTEM_PROMPT = `あなたはLINE Botのコマンドパーサーです。
ユーザーのメッセージを解析し、以下のJSON形式で返してください。
余分なテキストやマークダウンは一切出力せず、JSONのみを返してください。

コマンド種別:
- タスク追加: { "type": "add" }
- タスク一覧: { "type": "list" }
- タスク完了: { "type": "complete", "query": "識別子またはキーワード" }
- 番号選択（完了候補から選ぶ）: { "type": "complete_select", "index": 番号 }
- タスク更新: { "type": "update", "query": "識別子またはキーワード" }
- 番号選択（更新候補から選ぶ）: { "type": "update_select", "index": 番号 }
- ヘルプ/不明: { "type": "help" }`;

const DESCRIPTION_ENHANCE_PROMPT = `あなたはタスク管理ツールの説明文ライターです。
ユーザーが入力した短いメモや箇条書きを、Linear のタスク説明として適切な文章に整形してください。

ルール:
- 内容を忠実に保ちつつ、読みやすい日本語に整える
- 必要に応じて箇条書き・見出しを使ってよい
- 意味を勝手に追加・変更しない
- 整形後の文章のみを出力する（前置き・説明は不要）`;

// ユーザー入力の説明文を Gemini で整形する
export async function enhanceDescription(text: string): Promise<string> {
  const model = genai.getGenerativeModel({
    model: env.GEMINI_MODEL,
    systemInstruction: DESCRIPTION_ENHANCE_PROMPT,
  });
  const result = await model.generateContent(text);
  return result.response.text().trim();
}

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

export const geminiRepository = {
  parseMessageWithGemini,
  enhanceDescription,
} satisfies GeminiRepository;
