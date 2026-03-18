import type { Command } from "@/domain/types";
import { parseMessageWithGemini } from "@/infrastructure/gemini";
import { getJSTDateString } from "@/utils/date";
import { logger } from "@/utils/logger";

// LINEメッセージをGeminiで解析してコマンドに変換する
// GeminiエラーまたはValidation失敗時はhelpにフォールバック
export async function parseCommand(message: string): Promise<Command> {
  try {
    return await parseMessageWithGemini(message, getJSTDateString());
  } catch (err) {
    logger.error({ err }, "コマンド解析エラー");
    return { type: "help" };
  }
}
