import type { LinearIssue } from "../types/index.js"

// 優先度アイコンを返す
function priorityIcon(priority: number): string {
  if (priority === 1 || priority === 2) return "🔴"
  if (priority === 3) return "🟡"
  return "⚪"
}

// 日付を「M/D（曜日）」形式にフォーマットする
function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return "なし"

  const date = new Date(dateStr + "T00:00:00+09:00")
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
  const dayName = weekdays[date.getDay()]
  const month = date.getMonth() + 1
  const day = date.getDate()

  // 今日かどうかチェック
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0]
  if (dateStr === todayStr) {
    return `${month}/${day}（今日！）`
  }

  return `${month}/${day}（${dayName}）`
}

// タスク追加完了メッセージを生成する
export function formatAddTaskMessage(issue: LinearIssue, assigneeName?: string): string {
  let message = `✅ タスクを作成しました\n`
  message += `[${issue.identifier}] ${issue.title}\n`

  if (issue.dueDate) {
    message += `期限: ${formatDueDate(issue.dueDate)}\n`
  }

  if (assigneeName) {
    message += `担当: ${assigneeName}さん\n`
  } else if (issue.assignee) {
    message += `担当: ${issue.assignee.name}さん\n`
  }

  message += `🔗 ${issue.url}`
  return message
}

// タスク一覧メッセージを生成する
export function formatListTasksMessage(issues: LinearIssue[]): string {
  if (issues.length === 0) {
    return "📋 現在のタスクはありません"
  }

  let message = `📋 あなたのタスク（${issues.length}件）\n`

  for (const issue of issues) {
    const icon = priorityIcon(issue.priority)
    const due = issue.dueDate ? formatDueDate(issue.dueDate) : "なし"
    message += `\n${icon} [${issue.identifier}] ${issue.title}\n`
    message += `   期限: ${due} | ${issue.state.name}`
  }

  return message
}

// タスク完了メッセージを生成する
export function formatCompleteTaskMessage(issue: LinearIssue): string {
  return `🎉 完了しました！\n[${issue.identifier}] ${issue.title}\nおつかれさまです！`
}

// タスク候補一覧メッセージを生成する
export function formatCandidatesMessage(issues: LinearIssue[]): string {
  let message = `🔍 該当するタスクが複数あります：\n`
  issues.forEach((issue, idx) => {
    message += `${idx + 1}. [${issue.identifier}] ${issue.title}\n`
  })
  message += `\n番号で選んでください（例: 完了 1）`
  return message
}
