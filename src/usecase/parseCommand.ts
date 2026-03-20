import type { GeminiRepository } from "@/domain/repositories";
import type { Command } from "@/domain/types";
import { getJSTDateString } from "@/utils/date";
import { logger } from "@/utils/logger";

type ParseCommandDeps = {
  gemini: Pick<GeminiRepository, "parseMessageWithGemini">;
};

// LINEメッセージをGeminiで解析してコマンドに変換する
// GeminiエラーまたはValidation失敗時はhelpにフォールバック
export async function parseCommand(deps: ParseCommandDeps, message: string): Promise<Command> {
  try {
    return await deps.gemini.parseMessageWithGemini(message, getJSTDateString());
  } catch (err) {
    logger.error({ err }, "コマンド解析エラー");
    return { type: "help" };
  }
}
