import { describe, expect, it, mock } from "bun:test";

const mockParseMessageWithGemini = mock();

mock.module("@/infrastructure/gemini", () => ({
  parseMessageWithGemini: mockParseMessageWithGemini,
}));
mock.module("@/utils/logger", () => ({
  logger: { error: () => {}, info: () => {}, warn: () => {} },
}));

const { parseCommand } = await import("@/usecase/parseCommand");

describe("parseCommand", () => {
  it("Gemini が成功した場合はそのコマンドを返す", async () => {
    mockParseMessageWithGemini.mockResolvedValue({ type: "list" });
    expect(await parseCommand("タスク一覧")).toEqual({ type: "list" });
  });

  it("Gemini がエラーを投げた場合は help にフォールバックする", async () => {
    mockParseMessageWithGemini.mockRejectedValue(new Error("API error"));
    expect(await parseCommand("意味不明なメッセージ")).toEqual({ type: "help" });
  });

  it("今日の日付（YYYY-MM-DD 形式）を Gemini に渡す", async () => {
    mockParseMessageWithGemini.mockResolvedValue({ type: "help" });
    await parseCommand("明日までにタスク追加");
    expect(mockParseMessageWithGemini).toHaveBeenCalledWith(
      "明日までにタスク追加",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    );
  });

  it("Gemini がバリデーション失敗エラーを投げても help を返す", async () => {
    mockParseMessageWithGemini.mockRejectedValue(new Error("コマンドの解析に失敗しました"));
    expect(await parseCommand("invalid")).toEqual({ type: "help" });
  });
});
