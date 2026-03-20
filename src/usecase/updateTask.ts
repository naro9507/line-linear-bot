import type { LineRepository, LinearRepository, UserRepository } from "@/domain/repositories";
import type { Command, LinearIssue, QuickReplyItem } from "@/domain/types";
import {
  formatUpdateCandidatesMessage,
  formatUpdateTaskMessage,
} from "@/presentation/formatMessage";
import { USER_NOT_FOUND_MESSAGE } from "@/utils/messages";

const UPDATE_TASK_TTL_MS = 10 * 60 * 1000; // 10分

type UpdateTaskStep = "waiting_field" | "waiting_title" | "waiting_duedate";

interface UpdateTaskSession {
  step: UpdateTaskStep;
  issueId: string;
  issueIdentifier: string;
  issueTitle: string;
  expiresAt: number;
}

// 複数候補のセッション管理
interface UpdateCandidateEntry {
  issues: LinearIssue[];
  expiresAt: number;
}

const sessions = new Map<string, UpdateTaskSession>();
const candidatesMap = new Map<string, UpdateCandidateEntry>();

const IDENTIFIER_PATTERN = /^[A-Z]+-\d+$/i;

function getSession(lineUserId: string): UpdateTaskSession | undefined {
  const session = sessions.get(lineUserId);
  if (!session) return undefined;
  if (Date.now() > session.expiresAt) {
    sessions.delete(lineUserId);
    return undefined;
  }
  return session;
}

function setSession(lineUserId: string, session: Omit<UpdateTaskSession, "expiresAt">): void {
  sessions.set(lineUserId, { ...session, expiresAt: Date.now() + UPDATE_TASK_TTL_MS });
}

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
  candidatesMap.set(lineUserId, { issues, expiresAt: Date.now() + UPDATE_TASK_TTL_MS });
}

export function hasActiveUpdateSession(lineUserId: string): boolean {
  return getSession(lineUserId) !== undefined;
}

type UpdateTaskDeps = {
  line: Pick<LineRepository, "replyMessage" | "replyWithQuickReply">;
  linear: Pick<
    LinearRepository,
    "searchIssues" | "getIssueByIdentifier" | "updateIssue" | "getTeamStates"
  >;
  users: Pick<UserRepository, "getUserByLineId" | "getAllUsers">;
};

// ---- タスク検索・候補提示 ----

export async function handleUpdateTask(
  deps: UpdateTaskDeps,
  command: Extract<Command, { type: "update" }>,
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
    const issue = candidates[0];
    setSession(lineUserId, {
      step: "waiting_field",
      issueId: issue.id,
      issueIdentifier: issue.identifier,
      issueTitle: issue.title,
    });
    candidatesMap.delete(lineUserId);
    await askUpdateField(deps, issue, replyToken);
  } else {
    setCandidates(lineUserId, candidates);
    await deps.line.replyMessage(replyToken, formatUpdateCandidatesMessage(candidates));
  }
}

// 候補番号から更新対象を選択
export async function handleUpdateSelect(
  deps: UpdateTaskDeps,
  command: Extract<Command, { type: "update_select" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const candidates = getCandidates(lineUserId);
  if (!candidates) {
    await deps.line.replyMessage(
      replyToken,
      "⚠️ 選択対象のタスクがありません。まず「更新 キーワード」で検索してください"
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

  const issue = candidates[index];
  candidatesMap.delete(lineUserId);
  setSession(lineUserId, {
    step: "waiting_field",
    issueId: issue.id,
    issueIdentifier: issue.identifier,
    issueTitle: issue.title,
  });
  await askUpdateField(deps, issue, replyToken);
}

// ---- テキスト入力ハンドラ（タイトル・期限） ----

export async function handleUpdateTaskTextInput(
  deps: UpdateTaskDeps,
  lineUserId: string,
  text: string,
  replyToken: string
): Promise<void> {
  const session = getSession(lineUserId);
  if (!session) return;

  if (session.step === "waiting_title") {
    const updated = await deps.linear.updateIssue(session.issueId, { title: text });
    sessions.delete(lineUserId);
    await deps.line.replyMessage(replyToken, formatUpdateTaskMessage(updated, "タイトル"));
    return;
  }

  if (session.step === "waiting_duedate") {
    const parsed = parseDueDateInput(text);
    if (parsed === undefined) {
      await deps.line.replyMessage(
        replyToken,
        "日付の形式が正しくありません。MM/DD または YYYY-MM-DD で入力するか、「なし」を選んでください"
      );
      return;
    }
    const updated = await deps.linear.updateIssue(session.issueId, { dueDate: parsed });
    sessions.delete(lineUserId);
    await deps.line.replyMessage(replyToken, formatUpdateTaskMessage(updated, "期限"));
    return;
  }
}

// ---- Postback ハンドラ ----

export async function handleUpdateTaskPostback(
  deps: UpdateTaskDeps,
  lineUserId: string,
  data: string,
  replyToken: string
): Promise<void> {
  const session = getSession(lineUserId);
  if (!session) return;

  // 更新フィールド選択
  if (data.startsWith("update_field:") && session.step === "waiting_field") {
    const field = data.slice("update_field:".length);

    if (field === "title") {
      setSession(lineUserId, { ...session, step: "waiting_title" });
      await deps.line.replyMessage(replyToken, "新しいタイトルを入力してください");
      return;
    }

    if (field === "duedate") {
      setSession(lineUserId, { ...session, step: "waiting_duedate" });
      const items: QuickReplyItem[] = [{ label: "なし", postbackData: "update_duedate:none" }];
      await deps.line.replyWithQuickReply(
        replyToken,
        "新しい期限は？（例: 3/25 または 2026-03-25）",
        items
      );
      return;
    }

    if (field === "priority") {
      const items: QuickReplyItem[] = [
        { label: "緊急", postbackData: "update_priority:1" },
        { label: "高", postbackData: "update_priority:2" },
        { label: "中", postbackData: "update_priority:3" },
        { label: "低", postbackData: "update_priority:4" },
        { label: "なし", postbackData: "update_priority:0" },
      ];
      await deps.line.replyWithQuickReply(replyToken, "新しい優先度は？", items);
      return;
    }

    if (field === "assignee") {
      const allUsers = deps.users.getAllUsers();
      const items: QuickReplyItem[] = allUsers.map((u) => ({
        label: u.displayName,
        postbackData: `update_assignee:${u.linearUserId}`,
      }));
      items.push({ label: "なし（未割当）", postbackData: "update_assignee:none" });
      await deps.line.replyWithQuickReply(replyToken, "新しい担当者は？", items);
      return;
    }

    if (field === "state") {
      const states = await deps.linear.getTeamStates();
      const items: QuickReplyItem[] = states.map((s) => ({
        label: s.name,
        postbackData: `update_state:${s.id}`,
      }));
      await deps.line.replyWithQuickReply(replyToken, "新しいステータスは？", items);
      return;
    }
  }

  // 期限「なし」選択
  if (data === "update_duedate:none" && session.step === "waiting_duedate") {
    const updated = await deps.linear.updateIssue(session.issueId, { dueDate: null });
    sessions.delete(lineUserId);
    await deps.line.replyMessage(replyToken, formatUpdateTaskMessage(updated, "期限"));
    return;
  }

  // 優先度選択
  if (data.startsWith("update_priority:") && session.step === "waiting_field") {
    const value = data.slice("update_priority:".length);
    const priority = Number(value);
    const updated = await deps.linear.updateIssue(session.issueId, { priority });
    sessions.delete(lineUserId);
    await deps.line.replyMessage(replyToken, formatUpdateTaskMessage(updated, "優先度"));
    return;
  }

  // 担当者選択
  if (data.startsWith("update_assignee:") && session.step === "waiting_field") {
    const value = data.slice("update_assignee:".length);
    const assigneeId = value === "none" ? null : value;
    const updated = await deps.linear.updateIssue(session.issueId, { assigneeId });
    sessions.delete(lineUserId);
    await deps.line.replyMessage(replyToken, formatUpdateTaskMessage(updated, "担当者"));
    return;
  }

  // ステータス選択
  if (data.startsWith("update_state:") && session.step === "waiting_field") {
    const stateId = data.slice("update_state:".length);
    const updated = await deps.linear.updateIssue(session.issueId, { stateId });
    sessions.delete(lineUserId);
    await deps.line.replyMessage(replyToken, formatUpdateTaskMessage(updated, "ステータス"));
    return;
  }
}

// ---- 更新項目選択のQuickReply ----

async function askUpdateField(
  deps: Pick<UpdateTaskDeps, "line">,
  issue: LinearIssue,
  replyToken: string
): Promise<void> {
  const items: QuickReplyItem[] = [
    { label: "タイトル", postbackData: "update_field:title" },
    { label: "期限", postbackData: "update_field:duedate" },
    { label: "優先度", postbackData: "update_field:priority" },
    { label: "担当者", postbackData: "update_field:assignee" },
    { label: "ステータス", postbackData: "update_field:state" },
  ];
  await deps.line.replyWithQuickReply(
    replyToken,
    `[${issue.identifier}] ${issue.title}\n何を更新しますか？`,
    items
  );
}

// ---- 日付パーサ ----

function parseDueDateInput(input: string): string | null | undefined {
  if (input === "なし") return null;
  const mmdd = /^(\d{1,2})\/(\d{1,2})$/.exec(input);
  if (mmdd) {
    const year = new Date().getFullYear();
    const month = mmdd[1].padStart(2, "0");
    const day = mmdd[2].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return undefined;
}
