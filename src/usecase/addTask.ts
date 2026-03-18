import { getUserByAlias, getUserByLineId } from "@/config/users";
import type { Command } from "@/domain/types";
import { replyMessage } from "@/infrastructure/line";
import { createIssue } from "@/infrastructure/linear";
import { formatAddTaskMessage } from "@/presentation/formatMessage";
import { USER_NOT_FOUND_MESSAGE } from "@/utils/messages";

export async function handleAddTask(
  command: Extract<Command, { type: "add" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const sender = getUserByLineId(lineUserId);
  if (!sender) {
    await replyMessage(replyToken, USER_NOT_FOUND_MESSAGE);
    return;
  }

  // 担当者: エイリアス指定があればそちら、なければ送信者
  const assignee = command.assignee ? getUserByAlias(command.assignee) : sender;
  const assigneeId = assignee?.linearUserId ?? sender.linearUserId;
  const assigneeName = assignee?.displayName ?? sender.displayName;

  const issue = await createIssue({
    title: command.title,
    dueDate: command.dueDate ?? null,
    assigneeId,
    priority: command.priority ?? null,
  });

  await replyMessage(replyToken, formatAddTaskMessage(issue, assigneeName));
}
