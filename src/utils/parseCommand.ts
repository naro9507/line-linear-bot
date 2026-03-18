import { parseMessageWithGemini } from "../services/gemini.js"
import type { Command } from "../types/index.js"

// 今日の日付をJSTで取得する
function getTodayJST(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split("T")[0]!
}

// LINEメッセージをGeminiで解析してコマンドに変換する
// エラー時はヘルプコマンドにフォールバック
export async function parseCommand(message: string): Promise<Command> {
  try {
    const today = getTodayJST()
    return await parseMessageWithGemini(message, today)
  } catch (err) {
    console.error("コマンド解析エラー:", err)
    // GeminiエラーまたはValibotバリデーション失敗時はヘルプにフォールバック
    return { type: "help" }
  }
}
