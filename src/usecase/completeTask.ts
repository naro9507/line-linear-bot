import { getIssueByIdentifier, searchIssues, completeIssue } from "@/infrastructure/linear";
import { replyMessage } from "@/infrastructure/line";
import { getUserByLineId } from "@/config/users";
import { formatCompleteTaskMessage, formatCandidatesMessage } from "@/presentation/formatMessage";
import { USER_NOT_FOUND_MESSAGE } from "@/utils/messages";
import type { Command, LinearIssue } from "@/domain/types";

const IDENTIFIER_PATTERN = /^[A-Z]+-\d+$/i;

// 候補エントリーの型（TTL管理用）
interface CandidateEntry {
  issues: LinearIssue[];
  expiresAt: number;
}

// ユーザーごとの完了候補タスクをセッション管理するMap（TTL: 10分）
const CANDIDATES_TTL_MS = 10 * 60 * 1000;
const candidatesMap = new Map<string, CandidateEntry>();

function getCandidates(lineUserId: string): LinearIssue[] | undefined {
  const entry = candidatesMap.get(lineUserId);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    candidatesMap.delete(lineUserId);
    return undefined;
  }
  return entry.issues;
}

function setCandidates(lineUserId: string, issues: LinearIssue[]): void {
  candidatesMap.set(lineUserId, { issues, expiresAt: Date.now() + CANDIDATES_TTL_MS });
}

export async function handleCompleteTask(
  command: Extract<Command, { type: "complete" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const user = getUserByLineId(lineUserId);
  if (!user) {
    await replyMessage(replyToken, USER_NOT_FOUND_MESSAGE);
    return;
  }

  let candidates: LinearIssue[];

  if (IDENTIFIER_PATTERN.test(command.query)) {
    const issue = await getIssueByIdentifier(command.query);
    if (!issue) {
      await replyMessage(replyToken, `⚠️ タスク [${command.query}] が見つかりませんでした`);
      return;
    }
    candidates = [issue];
  } else {
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
    setCandidates(lineUserId, candidates);
    await replyMessage(replyToken, formatCandidatesMessage(candidates));
  }
}

export async function handleCompleteSelect(
  command: Extract<Command, { type: "complete_select" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const candidates = getCandidates(lineUserId);
  if (!candidates) {
    await replyMessage(
      replyToken,
      "⚠️ 選択対象のタスクがありません。まず「完了 キーワード」で検索してください"
    );
    return;
  }

  const index = command.index - 1; // 1始まりを0始まりに変換
  if (command.index < 1 || index >= candidates.length) {
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
