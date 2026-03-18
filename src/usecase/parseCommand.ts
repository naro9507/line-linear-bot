import { parseMessageWithGemini } from "@/infrastructure/gemini";
import { getJSTDateString } from "@/utils/date";
import type { Command } from "@/domain/types";

// LINEメッセージをGeminiで解析してコマンドに変換する
// GeminiエラーまたはValidation失敗時はhelpにフォールバック
export async function parseCommand(message: string): Promise<Command> {
  try {
    return await parseMessageWithGemini(message, getJSTDateString());
  } catch (err) {
    console.error("コマンド解析エラー:", err);
    return { type: "help" };
  }
}
