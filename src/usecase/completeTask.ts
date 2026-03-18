import { getIssueByIdentifier, searchIssues, completeIssue } from "@/infrastructure/linear";
import { replyMessage } from "@/infrastructure/line";
import { getUserByLineId } from "@/config/users";
import { formatCompleteTaskMessage, formatCandidatesMessage } from "@/presentation/formatMessage";
import type { Command, LinearIssue } from "@/domain/types";

// ユーザーごとの完了候補タスクをセッション管理するMap
const candidatesMap = new Map<string, LinearIssue[]>();

const IDENTIFIER_PATTERN = /^[A-Z]+-\d+$/i;

export async function handleCompleteTask(
  command: Extract<Command, { type: "complete" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const user = getUserByLineId(lineUserId);
  if (!user) {
    await replyMessage(
      replyToken,
      "⚠️ あなたのアカウントがまだ登録されていません。管理者に連絡してください"
    );
    return;
  }

  let candidates: LinearIssue[];

  if (IDENTIFIER_PATTERN.test(command.query)) {
    // 識別子で直接取得
    const issue = await getIssueByIdentifier(command.query);
    if (!issue) {
      await replyMessage(replyToken, `⚠️ タスク [${command.query}] が見つかりませんでした`);
      return;
    }
    candidates = [issue];
  } else {
    // キーワードで検索
    candidates = await searchIssues(command.query);
    if (candidates.length === 0) {
      await replyMessage(replyToken, `⚠️ 「${command.query}」に該当するタスクが見つかりませんでした`);
      return;
    }
  }

  if (candidates.length === 1) {
    const completed = await completeIssue(candidates[0]!.id);
    candidatesMap.delete(lineUserId);
    await replyMessage(replyToken, formatCompleteTaskMessage(completed));
  } else {
    candidatesMap.set(lineUserId, candidates);
    await replyMessage(replyToken, formatCandidatesMessage(candidates));
  }
}

export async function handleCompleteSelect(
  command: Extract<Command, { type: "complete_select" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const candidates = candidatesMap.get(lineUserId);
  if (!candidates?.length) {
    await replyMessage(
      replyToken,
      "⚠️ 選択対象のタスクがありません。まず「完了 キーワード」で検索してください"
    );
    return;
  }

  const index = command.index - 1; // 1始まりを0始まりに変換
  if (index < 0 || index >= candidates.length) {
    await replyMessage(
      replyToken,
      `⚠️ 無効な番号です。1〜${candidates.length}の番号を入力してください`
    );
    return;
  }

  const completed = await completeIssue(candidates[index]!.id);
  candidatesMap.delete(lineUserId);
  await replyMessage(replyToken, formatCompleteTaskMessage(completed));
}
