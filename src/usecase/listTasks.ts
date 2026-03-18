import { getUserByLineId } from "@/config/users";
import { replyMessage } from "@/infrastructure/line";
import { listMyIssues } from "@/infrastructure/linear";
import { formatListTasksMessage } from "@/presentation/formatMessage";
import { USER_NOT_FOUND_MESSAGE } from "@/utils/messages";

export async function handleListTasks(lineUserId: string, replyToken: string): Promise<void> {
  const user = getUserByLineId(lineUserId);
  if (!user) {
    await replyMessage(replyToken, USER_NOT_FOUND_MESSAGE);
    return;
  }

  const issues = await listMyIssues(user.linearUserId);
  await replyMessage(replyToken, formatListTasksMessage(issues));
}
