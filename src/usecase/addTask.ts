import type { LineRepository, LinearRepository, UserRepository } from "@/domain/repositories";
import type { Command } from "@/domain/types";
import { formatAddTaskMessage } from "@/presentation/formatMessage";
import { USER_NOT_FOUND_MESSAGE } from "@/utils/messages";

type AddTaskDeps = {
  line: Pick<LineRepository, "replyMessage">;
  linear: Pick<LinearRepository, "createIssue">;
  users: Pick<UserRepository, "getUserByLineId" | "getUserByAlias">;
};

export async function handleAddTask(
  deps: AddTaskDeps,
  command: Extract<Command, { type: "add" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const sender = deps.users.getUserByLineId(lineUserId);
  if (!sender) {
    await deps.line.replyMessage(replyToken, USER_NOT_FOUND_MESSAGE);
    return;
  }

  // 担当者: エイリアス指定があればそちら、なければ送信者
  const assignee = command.assignee ? deps.users.getUserByAlias(command.assignee) : sender;
  const assigneeId = assignee?.linearUserId ?? sender.linearUserId;
  const assigneeName = assignee?.displayName ?? sender.displayName;

  const issue = await deps.linear.createIssue({
    title: command.title,
    dueDate: command.dueDate ?? null,
    assigneeId,
    priority: command.priority ?? null,
  });

  await deps.line.replyMessage(replyToken, formatAddTaskMessage(issue, assigneeName));
}
