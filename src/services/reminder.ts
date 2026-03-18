import { getRemindIssues } from "./linear.js"
import { pushMessage } from "./line.js"
import { getUserByLinearId } from "../config/users.js"
import type { LinearIssue } from "../types/index.js"

// 今日の日付文字列を取得（JST）
function getTodayJST(): string {
  const now = new Date()
  // JSTに変換（UTC+9）
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split("T")[0]!
}

// 明日の日付文字列を取得（JST）
function getTomorrowJST(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  jst.setDate(jst.getDate() + 1)
  return jst.toISOString().split("T")[0]!
}

// 日付を「M/D」形式にフォーマットする
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00+09:00")
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// リマインド通知メッセージを組み立てる
function buildRemindMessage(
  todayIssues: LinearIssue[],
  tomorrowIssues: LinearIssue[]
): string {
  const today = getTodayJST()
  const date = new Date(today + "T00:00:00+09:00")
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`

  let message = `⏰ おはようございます！（${dateStr}）\n`

  if (todayIssues.length > 0) {
    message += `\n🔥 今日が期限：\n`
    for (const issue of todayIssues) {
      message += `  [${issue.identifier}] ${issue.title}\n`
    }
  }

  if (tomorrowIssues.length > 0) {
    message += `\n⚠️ 明日が期限：\n`
    for (const issue of tomorrowIssues) {
      message += `  [${issue.identifier}] ${issue.title}\n`
    }
  }

  message += `\n今日もがんばりましょう 💪`
  return message
}

// リマインド処理を実行する
export async function runReminder(): Promise<void> {
  const issues = await getRemindIssues()
  if (issues.length === 0) return

  const today = getTodayJST()
  const tomorrow = getTomorrowJST()

  // ユーザーごとにグルーピング
  const userIssuesMap = new Map<string, { today: LinearIssue[]; tomorrow: LinearIssue[] }>()

  for (const issue of issues) {
    if (!issue.assignee) continue

    const linearUserId = issue.assignee.id
    if (!userIssuesMap.has(linearUserId)) {
      userIssuesMap.set(linearUserId, { today: [], tomorrow: [] })
    }

    const entry = userIssuesMap.get(linearUserId)!
    if (issue.dueDate === today) {
      entry.today.push(issue)
    } else if (issue.dueDate === tomorrow) {
      entry.tomorrow.push(issue)
    }
  }

  // 各ユーザーに通知を送信
  for (const [linearUserId, { today: todayIssues, tomorrow: tomorrowIssues }] of userIssuesMap) {
    if (todayIssues.length === 0 && tomorrowIssues.length === 0) continue

    const userMapping = getUserByLinearId(linearUserId)
    if (!userMapping) continue

    const message = buildRemindMessage(todayIssues, tomorrowIssues)
    await pushMessage(userMapping.lineUserId, message)
  }
}
