import type { LineRepository, LinearRepository, UserRepository } from "@/domain/repositories";
import { formatListTasksMessage } from "@/presentation/formatMessage";
import { USER_NOT_FOUND_MESSAGE } from "@/utils/messages";

type ListTasksDeps = {
  line: Pick<LineRepository, "replyMessage">;
  linear: Pick<LinearRepository, "listMyIssues">;
  users: Pick<UserRepository, "getUserByLineId">;
};

export async function handleListTasks(
  deps: ListTasksDeps,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const user = deps.users.getUserByLineId(lineUserId);
  if (!user) {
    await deps.line.replyMessage(replyToken, USER_NOT_FOUND_MESSAGE);
    return;
  }

  const issues = await deps.linear.listMyIssues(user.linearUserId);
  await deps.line.replyMessage(replyToken, formatListTasksMessage(issues));
}

type ListUserTasksDeps = {
  line: Pick<LineRepository, "replyMessage">;
  linear: Pick<LinearRepository, "listMyIssues">;
  users: Pick<UserRepository, "getUserByAlias">;
};

export async function handleListUserTasks(
  deps: ListUserTasksDeps,
  alias: string,
  replyToken: string
): Promise<void> {
  const user = deps.users.getUserByAlias(alias);
  if (!user) {
    await deps.line.replyMessage(replyToken, `「${alias}」に対応するユーザーが見つかりません`);
    return;
  }

  const issues = await deps.linear.listMyIssues(user.linearUserId);
  await deps.line.replyMessage(replyToken, formatListTasksMessage(issues, user.displayName));
}
