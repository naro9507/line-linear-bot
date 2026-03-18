import { getJSTDateString, parseJSTDate } from "@/utils/date";
import type { LinearIssue } from "@/domain/types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function priorityIcon(priority: number): string {
  if (priority === 1 || priority === 2) return "🔴";
  if (priority === 3) return "🟡";
  return "⚪";
}

function formatDueDate(dateStr: string | null, todayStr: string): string {
  if (!dateStr) return "なし";
  const date = parseJSTDate(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (dateStr === todayStr) return `${month}/${day}（今日！）`;
  return `${month}/${day}（${WEEKDAYS[date.getDay()]}）`;
}

export function formatAddTaskMessage(issue: LinearIssue, assigneeName?: string): string {
  const today = getJSTDateString();
  let msg = `✅ タスクを作成しました\n[${issue.identifier}] ${issue.title}`;
  if (issue.dueDate) msg += `\n期限: ${formatDueDate(issue.dueDate, today)}`;
  if (assigneeName) msg += `\n担当: ${assigneeName}さん`;
  else if (issue.assignee) msg += `\n担当: ${issue.assignee.name}さん`;
  msg += `\n🔗 ${issue.url}`;
  return msg;
}

export function formatListTasksMessage(issues: LinearIssue[]): string {
  if (issues.length === 0) return "📋 現在のタスクはありません";

  const today = getJSTDateString();
  let msg = `📋 あなたのタスク（${issues.length}件）`;
  for (const issue of issues) {
    msg += `\n\n${priorityIcon(issue.priority)} [${issue.identifier}] ${issue.title}`;
    msg += `\n   期限: ${formatDueDate(issue.dueDate, today)} | ${issue.state.name}`;
  }
  return msg;
}

export function formatCompleteTaskMessage(issue: LinearIssue): string {
  return `🎉 完了しました！\n[${issue.identifier}] ${issue.title}\nおつかれさまです！`;
}

export function formatCandidatesMessage(issues: LinearIssue[]): string {
  let msg = "🔍 該当するタスクが複数あります：\n";
  issues.forEach((issue, i) => {
    msg += `${i + 1}. [${issue.identifier}] ${issue.title}\n`;
  });
  return `${msg}\n番号で選んでください（例: 完了 1）`;
}
