import { createIssue } from "../services/linear.js"
import { replyMessage } from "../services/line.js"
import { getUserByLineId, getUserByAlias } from "../config/users.js"
import { formatAddTaskMessage } from "../utils/formatMessage.js"
import type { Command } from "../types/index.js"

// タスク追加コマンドを処理する
export async function handleAddTask(
  command: Extract<Command, { type: "add" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  // 送信者のLinearユーザーを解決
  const senderMapping = getUserByLineId(lineUserId)
  if (!senderMapping) {
    await replyMessage(
      replyToken,
      "⚠️ あなたのアカウントがまだ登録されていません。管理者に連絡してください"
    )
    return
  }

  // 担当者を解決（エイリアス指定がある場合はそちらを優先、なければ送信者）
  let assigneeId: string | null = senderMapping.linearUserId
  let assigneeName: string | undefined = senderMapping.displayName

  if (command.assignee) {
    const assigneeMapping = getUserByAlias(command.assignee)
    if (assigneeMapping) {
      assigneeId = assigneeMapping.linearUserId
      assigneeName = assigneeMapping.displayName
    }
  }

  const issue = await createIssue({
    title: command.title,
    dueDate: command.dueDate ?? null,
    assigneeId,
    priority: command.priority ?? null,
  })

  const message = formatAddTaskMessage(issue, assigneeName)
  await replyMessage(replyToken, message)
}
