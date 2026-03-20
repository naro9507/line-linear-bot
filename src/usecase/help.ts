import type { LineRepository } from "@/domain/repositories";

type HelpDeps = {
  line: Pick<LineRepository, "replyMessage">;
};

const HELP_MESSAGE = `📖 使い方ガイド

📝 タスク追加
  「追加 〇〇」
  オプション: 期限・担当・優先度

📋 一覧確認
  「一覧」

✅ タスク完了
  「完了 ENG-42」or「完了 〇〇」

わからないことがあれば「ヘルプ」と送ってね！`;

export async function handleHelp(deps: HelpDeps, replyToken: string): Promise<void> {
  await deps.line.replyMessage(replyToken, HELP_MESSAGE);
}
