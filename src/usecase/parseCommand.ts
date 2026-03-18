import { parseMessageWithGemini } from "@/infrastructure/gemini";
import type { Command } from "@/domain/types";

// 今日の日付をJSTで取得する
function getTodayJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0]!;
}

// LINEメッセージをGeminiで解析してコマンドに変換する
// GeminiエラーまたはValidation失敗時はhelpにフォールバック
export async function parseCommand(message: string): Promise<Command> {
  try {
    return await parseMessageWithGemini(message, getTodayJST());
  } catch (err) {
    console.error("コマンド解析エラー:", err);
    return { type: "help" };
  }
}
