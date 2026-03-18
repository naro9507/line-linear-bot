import { listMyIssues } from "@/infrastructure/linear";
import { replyMessage } from "@/infrastructure/line";
import { getUserByLineId } from "@/config/users";
import { formatListTasksMessage } from "@/presentation/formatMessage";

export async function handleListTasks(lineUserId: string, replyToken: string): Promise<void> {
  const user = getUserByLineId(lineUserId);
  if (!user) {
    await replyMessage(
      replyToken,
      "⚠️ あなたのアカウントがまだ登録されていません。管理者に連絡してください"
    );
    return;
  }

  const issues = await listMyIssues(user.linearUserId);
  await replyMessage(replyToken, formatListTasksMessage(issues));
}
