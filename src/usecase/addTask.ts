import { createIssue } from "@/infrastructure/linear";
import { replyMessage } from "@/infrastructure/line";
import { getUserByLineId, getUserByAlias } from "@/config/users";
import { formatAddTaskMessage } from "@/presentation/formatMessage";
import type { Command } from "@/domain/types";

export async function handleAddTask(
  command: Extract<Command, { type: "add" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const sender = getUserByLineId(lineUserId);
  if (!sender) {
    await replyMessage(
      replyToken,
      "⚠️ あなたのアカウントがまだ登録されていません。管理者に連絡してください"
    );
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
