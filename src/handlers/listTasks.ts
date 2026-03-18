import { listMyIssues } from "../services/linear.js"
import { replyMessage } from "../services/line.js"
import { getUserByLineId } from "../config/users.js"
import { formatListTasksMessage } from "../utils/formatMessage.js"

// タスク一覧コマンドを処理する
export async function handleListTasks(
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const userMapping = getUserByLineId(lineUserId)
  if (!userMapping) {
    await replyMessage(
      replyToken,
      "⚠️ あなたのアカウントがまだ登録されていません。管理者に連絡してください"
    )
    return
  }

  const issues = await listMyIssues(userMapping.linearUserId)
  const message = formatListTasksMessage(issues)
  await replyMessage(replyToken, message)
}
