import type {
  GeminiRepository,
  LineRepository,
  LinearRepository,
  UserRepository,
} from "@/domain/repositories";
import type { QuickReplyItem } from "@/domain/types";
import { formatAddTaskMessage } from "@/presentation/formatMessage";

const ADD_TASK_TTL_MS = 10 * 60 * 1000; // 10分

type AddTaskStep =
  | "waiting_title"
  | "waiting_assignee"
  | "waiting_priority"
  | "waiting_duedate"
  | "waiting_description";

interface AddTaskSession {
  step: AddTaskStep;
  title?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  priority?: number | null;
  dueDate?: string | null;
  expiresAt: number;
}

const sessions = new Map<string, AddTaskSession>();

function getSession(lineUserId: string): AddTaskSession | undefined {
  const session = sessions.get(lineUserId);
  if (!session) return undefined;
  if (Date.now() > session.expiresAt) {
    sessions.delete(lineUserId);
    return undefined;
  }
  return session;
}

function setSession(lineUserId: string, session: Omit<AddTaskSession, "expiresAt">): void {
  sessions.set(lineUserId, { ...session, expiresAt: Date.now() + ADD_TASK_TTL_MS });
}

export function hasActiveAddSession(lineUserId: string): boolean {
  return getSession(lineUserId) !== undefined;
}

// ---- ステップ開始 ----

type StartAddTaskDeps = {
  line: Pick<LineRepository, "replyMessage">;
};

export async function startAddTask(
  deps: StartAddTaskDeps,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  setSession(lineUserId, { step: "waiting_title" });
  await deps.line.replyMessage(replyToken, "タスク名を入力してください");
}

// ---- テキスト入力ハンドラ（タイトル・期限・説明） ----

type AddTaskDeps = {
  line: Pick<LineRepository, "replyMessage" | "replyWithQuickReply">;
  linear: Pick<LinearRepository, "createIssue">;
  users: Pick<UserRepository, "getAllUsers" | "getUserByLineId">;
  gemini: Pick<GeminiRepository, "enhanceDescription">;
};

export async function handleAddTaskTextInput(
  deps: AddTaskDeps,
  lineUserId: string,
  text: string,
  replyToken: string
): Promise<void> {
  const session = getSession(lineUserId);
  if (!session) return;

  if (session.step === "waiting_title") {
    setSession(lineUserId, { ...session, step: "waiting_assignee", title: text });
    await askAssignee(deps, lineUserId, replyToken);
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
    setSession(lineUserId, { ...session, step: "waiting_description", dueDate: parsed });
    await askDescription(deps, replyToken);
    return;
  }

  if (session.step === "waiting_description") {
    await createAndReply(deps, lineUserId, session, text, replyToken);
    return;
  }
}

// ---- Postback ハンドラ（担当者・優先度・期限なし・説明スキップ） ----

export async function handleAddTaskPostback(
  deps: AddTaskDeps,
  lineUserId: string,
  data: string,
  replyToken: string
): Promise<void> {
  const session = getSession(lineUserId);
  if (!session) return;

  if (data.startsWith("add_assignee:") && session.step === "waiting_assignee") {
    const value = data.slice("add_assignee:".length);
    const assigneeId = value === "none" ? null : value;
    const assignee = deps.users.getAllUsers().find((u) => u.linearUserId === assigneeId);
    setSession(lineUserId, {
      ...session,
      step: "waiting_priority",
      assigneeId,
      assigneeName: assignee?.displayName ?? null,
    });
    await askPriority(deps, replyToken);
    return;
  }

  if (data.startsWith("add_priority:") && session.step === "waiting_priority") {
    const value = data.slice("add_priority:".length);
    const priority = value === "none" ? null : Number(value);
    setSession(lineUserId, { ...session, step: "waiting_duedate", priority });
    await askDueDate(deps, replyToken);
    return;
  }

  if (data === "add_duedate:none" && session.step === "waiting_duedate") {
    setSession(lineUserId, { ...session, step: "waiting_description", dueDate: null });
    await askDescription(deps, replyToken);
    return;
  }

  if (data === "add_description:skip" && session.step === "waiting_description") {
    await createAndReply(deps, lineUserId, session, null, replyToken);
    return;
  }
}

// ---- 各ステップの質問送信 ----

async function askAssignee(
  deps: Pick<AddTaskDeps, "line" | "users">,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const self = deps.users.getUserByLineId(lineUserId);
  const items: QuickReplyItem[] = deps.users.getAllUsers().map((user) => ({
    label:
      user.linearUserId === self?.linearUserId ? `${user.displayName}（自分）` : user.displayName,
    postbackData: `add_assignee:${user.linearUserId}`,
  }));
  items.push({ label: "なし", postbackData: "add_assignee:none" });
  await deps.line.replyWithQuickReply(replyToken, "担当者は？", items);
}

async function askPriority(deps: Pick<AddTaskDeps, "line">, replyToken: string): Promise<void> {
  const items: QuickReplyItem[] = [
    { label: "緊急", postbackData: "add_priority:1" },
    { label: "高", postbackData: "add_priority:2" },
    { label: "中", postbackData: "add_priority:3" },
    { label: "低", postbackData: "add_priority:4" },
    { label: "なし", postbackData: "add_priority:none" },
  ];
  await deps.line.replyWithQuickReply(replyToken, "優先度は？", items);
}

async function askDueDate(deps: Pick<AddTaskDeps, "line">, replyToken: string): Promise<void> {
  const items: QuickReplyItem[] = [{ label: "なし", postbackData: "add_duedate:none" }];
  await deps.line.replyWithQuickReply(replyToken, "期限は？（例: 3/25 または 2026-03-25）", items);
}

async function askDescription(deps: Pick<AddTaskDeps, "line">, replyToken: string): Promise<void> {
  const items: QuickReplyItem[] = [{ label: "スキップ", postbackData: "add_description:skip" }];
  await deps.line.replyWithQuickReply(replyToken, "説明を入力してください（任意）", items);
}

// ---- Issue作成・返信 ----

async function createAndReply(
  deps: AddTaskDeps,
  lineUserId: string,
  session: AddTaskSession,
  description: string | null,
  replyToken: string
): Promise<void> {
  sessions.delete(lineUserId);
  const enhancedDescription = description
    ? await deps.gemini.enhanceDescription(description)
    : null;
  const issue = await deps.linear.createIssue({
    title: session.title ?? "",
    dueDate: session.dueDate,
    assigneeId: session.assigneeId,
    priority: session.priority,
    description: enhancedDescription,
  });
  await deps.line.replyMessage(
    replyToken,
    formatAddTaskMessage(issue, session.assigneeName ?? undefined)
  );
}

// ---- 日付パーサ ----

// 返値: YYYY-MM-DD 文字列 | null（なし）| undefined（無効な形式）
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
