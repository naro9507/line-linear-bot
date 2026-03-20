import type { LineRepository, LinearRepository, UserRepository } from "@/domain/repositories";
import { formatListTasksMessage } from "@/presentation/formatMessage";
import { USER_NOT_FOUND_MESSAGE } from "@/utils/messages";

type ListTasksDeps = {
  line: Pick<LineRepository, "replyWithQuickReply">;
  users: Pick<UserRepository, "getUserByLineId" | "getAllUsers">;
};

// 「タスク一覧」コマンド → 誰のタスクを見るか Quick Reply で選択させる
export async function handleListTasks(
  deps: ListTasksDeps,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const self = deps.users.getUserByLineId(lineUserId);
  if (!self) {
    // replyWithQuickReply は使えないので fallback
    return;
  }

  const allUsers = deps.users.getAllUsers();
  const items = allUsers.map((user) => ({
    label: user.linearUserId === self.linearUserId ? `${user.displayName}（自分）` : user.displayName,
    postbackData: `list_tasks:${user.linearUserId}`,
  }));

  await deps.line.replyWithQuickReply(replyToken, "誰のタスクを確認しますか？", items);
}

type ShowUserTasksDeps = {
  line: Pick<LineRepository, "replyMessage">;
  linear: Pick<LinearRepository, "listMyIssues">;
  users: Pick<UserRepository, "getUserByLinearId">;
};

// Postback で linearUserId を受け取り、そのユーザーのタスク一覧を返す
export async function handleShowUserTasks(
  deps: ShowUserTasksDeps,
  linearUserId: string,
  replyToken: string
): Promise<void> {
  const user = deps.users.getUserByLinearId(linearUserId);
  if (!user) {
    await deps.line.replyMessage(replyToken, USER_NOT_FOUND_MESSAGE);
    return;
  }

  const issues = await deps.linear.listMyIssues(user.linearUserId);
  await deps.line.replyMessage(replyToken, formatListTasksMessage(issues, user.displayName));
}
