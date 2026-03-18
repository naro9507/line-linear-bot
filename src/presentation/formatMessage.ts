import type { LinearIssue } from "@/domain/types";

function priorityIcon(priority: number): string {
  if (priority === 1 || priority === 2) return "🔴";
  if (priority === 3) return "🟡";
  return "⚪";
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return "なし";

  const date = new Date(`${dateStr}T00:00:00+09:00`);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayName = weekdays[date.getDay()];

  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  if (dateStr === todayStr) return `${month}/${day}（今日！）`;

  return `${month}/${day}（${dayName}）`;
}

export function formatAddTaskMessage(issue: LinearIssue, assigneeName?: string): string {
  let msg = `✅ タスクを作成しました\n[${issue.identifier}] ${issue.title}`;
  if (issue.dueDate) msg += `\n期限: ${formatDueDate(issue.dueDate)}`;
  if (assigneeName) msg += `\n担当: ${assigneeName}さん`;
  else if (issue.assignee) msg += `\n担当: ${issue.assignee.name}さん`;
  msg += `\n🔗 ${issue.url}`;
  return msg;
}

export function formatListTasksMessage(issues: LinearIssue[]): string {
  if (issues.length === 0) return "📋 現在のタスクはありません";

  let msg = `📋 あなたのタスク（${issues.length}件）`;
  for (const issue of issues) {
    const icon = priorityIcon(issue.priority);
    msg += `\n\n${icon} [${issue.identifier}] ${issue.title}`;
    msg += `\n   期限: ${formatDueDate(issue.dueDate)} | ${issue.state.name}`;
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
