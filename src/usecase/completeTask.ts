import type { LineRepository, LinearRepository, UserRepository } from "@/domain/repositories";
import type { Command, LinearIssue } from "@/domain/types";
import { formatCandidatesMessage, formatCompleteTaskMessage } from "@/presentation/formatMessage";
import { USER_NOT_FOUND_MESSAGE } from "@/utils/messages";

type CompleteTaskDeps = {
  line: Pick<LineRepository, "replyMessage">;
  linear: Pick<LinearRepository, "searchIssues" | "getIssueByIdentifier" | "completeIssue">;
  users: Pick<UserRepository, "getUserByLineId">;
};

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
  deps: CompleteTaskDeps,
  command: Extract<Command, { type: "complete" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const user = deps.users.getUserByLineId(lineUserId);
  if (!user) {
    await deps.line.replyMessage(replyToken, USER_NOT_FOUND_MESSAGE);
    return;
  }

  let candidates: LinearIssue[];

  if (IDENTIFIER_PATTERN.test(command.query)) {
    const issue = await deps.linear.getIssueByIdentifier(command.query);
    if (!issue) {
      await deps.line.replyMessage(
        replyToken,
        `⚠️ タスク [${command.query}] が見つかりませんでした`
      );
      return;
    }
    candidates = [issue];
  } else {
    candidates = await deps.linear.searchIssues(command.query);
    if (candidates.length === 0) {
      await deps.line.replyMessage(
        replyToken,
        `⚠️ 「${command.query}」に該当するタスクが見つかりませんでした`
      );
      return;
    }
  }

  if (candidates.length === 1) {
    const completed = await deps.linear.completeIssue(candidates[0]?.id);
    candidatesMap.delete(lineUserId);
    await deps.line.replyMessage(replyToken, formatCompleteTaskMessage(completed));
  } else {
    setCandidates(lineUserId, candidates);
    await deps.line.replyMessage(replyToken, formatCandidatesMessage(candidates));
  }
}

export async function handleCompleteSelect(
  deps: CompleteTaskDeps,
  command: Extract<Command, { type: "complete_select" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const candidates = getCandidates(lineUserId);
  if (!candidates) {
    await deps.line.replyMessage(
      replyToken,
      "⚠️ 選択対象のタスクがありません。まず「完了 キーワード」で検索してください"
    );
    return;
  }

  const index = command.index - 1; // 1始まりを0始まりに変換
  if (command.index < 1 || index >= candidates.length) {
    await deps.line.replyMessage(
      replyToken,
      `⚠️ 無効な番号です。1〜${candidates.length}の番号を入力してください`
    );
    return;
  }

  const completed = await deps.linear.completeIssue(candidates[index]?.id);
  candidatesMap.delete(lineUserId);
  await deps.line.replyMessage(replyToken, formatCompleteTaskMessage(completed));
}
