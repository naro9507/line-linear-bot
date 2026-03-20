import { userRepository } from "@/config/users";
import { geminiRepository } from "@/infrastructure/gemini";
import { lineRepository } from "@/infrastructure/line";
import { linearRepository } from "@/infrastructure/linear";
import { verifyLineSignature } from "@/infrastructure/signature";
import {
  handleAddTaskPostback,
  handleAddTaskTextInput,
  hasActiveAddSession,
  startAddTask,
} from "@/usecase/addTask";
import { handleCompleteSelect, handleCompleteTask } from "@/usecase/completeTask";
import { handleHelp } from "@/usecase/help";
import { handleListTasks, handleShowUserTasks } from "@/usecase/listTasks";
import { parseCommand } from "@/usecase/parseCommand";
import {
  handleUpdateSelect,
  handleUpdateTask,
  handleUpdateTaskPostback,
  handleUpdateTaskTextInput,
  hasActiveUpdateSession,
} from "@/usecase/updateTask";
import { logger } from "@/utils/logger";
import { Hono } from "hono";
import * as v from "valibot";

// ValibotによるWebhookボディのスキーマ定義（unsafe castの代替）
const LineEventSchema = v.looseObject({
  type: v.string(),
  replyToken: v.optional(v.string()),
  source: v.looseObject({
    type: v.string(),
    userId: v.optional(v.string()),
  }),
  message: v.optional(
    v.looseObject({
      type: v.string(),
      id: v.string(),
      text: v.optional(v.string()),
    })
  ),
  postback: v.optional(
    v.looseObject({
      data: v.string(),
    })
  ),
});

const WebhookBodySchema = v.object({
  destination: v.string(),
  events: v.array(LineEventSchema),
});

type ValidatedWebhookBody = v.InferOutput<typeof WebhookBodySchema>;

// 各レイヤーの deps を composition root としてここで組み立てる
const deps = {
  line: lineRepository,
  linear: linearRepository,
  users: userRepository,
  gemini: geminiRepository,
};

export const webhookRouter = new Hono();

webhookRouter.post("/webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("x-line-signature") ?? "";

  // LINE署名検証（Bun crypto.subtle使用）
  const isValid = await verifyLineSignature(rawBody, signature);
  if (!isValid) return c.text("Forbidden", 403);

  // ValibotでボディをパースしてからJSONとして扱う（unsafe cast排除）
  const parseResult = v.safeParse(WebhookBodySchema, JSON.parse(rawBody));
  if (!parseResult.success) {
    logger.error({ issues: parseResult.issues }, "Webhookボディのパース失敗");
    return c.text("OK", 200); // LINEには常に200を返す
  }

  // 即座に200を返し、処理は非同期で継続
  processEvents(parseResult.output).catch((err) => {
    logger.error({ err }, "Webhookイベント処理エラー");
  });

  return c.text("OK", 200);
});

async function processEvents(body: ValidatedWebhookBody): Promise<void> {
  const tasks = body.events
    .filter((e) => e.replyToken && e.source.userId)
    .flatMap((e) => {
      const lineUserId = e.source.userId ?? "";
      const replyToken = e.replyToken ?? "";

      if (e.type === "message" && e.message?.type === "text" && e.message.text) {
        return [handleMessage(e.message.text, lineUserId, replyToken)];
      }
      if (e.type === "postback" && e.postback?.data) {
        return [handlePostback(e.postback.data, lineUserId, replyToken)];
      }
      return [];
    });

  await Promise.all(tasks);
}

async function handleMessage(text: string, lineUserId: string, replyToken: string): Promise<void> {
  try {
    // タスク追加セッション中はGeminiを経由せず直接入力を処理する
    if (hasActiveAddSession(lineUserId)) {
      await handleAddTaskTextInput(deps, lineUserId, text, replyToken);
      return;
    }

    // タスク更新セッション中はGeminiを経由せず直接入力を処理する
    if (hasActiveUpdateSession(lineUserId)) {
      await handleUpdateTaskTextInput(deps, lineUserId, text, replyToken);
      return;
    }

    const command = await parseCommand({ gemini: deps.gemini }, text);

    switch (command.type) {
      case "add":
        await startAddTask(deps, lineUserId, replyToken);
        break;
      case "list":
        await handleListTasks(deps, lineUserId, replyToken);
        break;
      case "complete":
        await handleCompleteTask(deps, command, lineUserId, replyToken);
        break;
      case "complete_select":
        await handleCompleteSelect(deps, command, lineUserId, replyToken);
        break;
      case "update":
        await handleUpdateTask(deps, command, lineUserId, replyToken);
        break;
      case "update_select":
        await handleUpdateSelect(deps, command, lineUserId, replyToken);
        break;
      case "help":
        await handleHelp({ line: deps.line }, replyToken);
        break;
    }
  } catch (err) {
    logger.error({ err, lineUserId, text }, "メッセージ処理エラー");
    const msg = err instanceof Error ? err.message : String(err);
    const reply = msg.toLowerCase().includes("linear")
      ? "⚠️ タスク管理サービスとの通信でエラーが発生しました。時間をおいて再度お試しください"
      : undefined;

    await (reply
      ? deps.line.replyMessage(replyToken, reply)
      : handleHelp({ line: deps.line }, replyToken)
    ).catch((e) => logger.error({ err: e }, "エラー返信失敗"));
  }
}

async function handlePostback(data: string, lineUserId: string, replyToken: string): Promise<void> {
  try {
    if (data.startsWith("list_tasks:")) {
      const linearUserId = data.slice("list_tasks:".length);
      await handleShowUserTasks(deps, linearUserId, replyToken);
      return;
    }

    if (
      data.startsWith("add_assignee:") ||
      data.startsWith("add_priority:") ||
      data === "add_duedate:none" ||
      data === "add_description:skip"
    ) {
      await handleAddTaskPostback(deps, lineUserId, data, replyToken);
      return;
    }

    if (
      data.startsWith("update_field:") ||
      data.startsWith("update_priority:") ||
      data.startsWith("update_assignee:") ||
      data.startsWith("update_state:") ||
      data === "update_duedate:none"
    ) {
      await handleUpdateTaskPostback(deps, lineUserId, data, replyToken);
      return;
    }
  } catch (err) {
    logger.error({ err, data }, "Postback処理エラー");
    await deps.line
      .replyMessage(
        replyToken,
        "⚠️ タスク管理サービスとの通信でエラーが発生しました。時間をおいて再度お試しください"
      )
      .catch((e) => logger.error({ err: e }, "エラー返信失敗"));
  }
}
