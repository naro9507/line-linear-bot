import { Hono } from "hono";
import * as v from "valibot";
import { verifyLineSignature } from "@/infrastructure/signature";
import { replyMessage } from "@/infrastructure/line";
import { parseCommand } from "@/usecase/parseCommand";
import { handleAddTask } from "@/usecase/addTask";
import { handleListTasks } from "@/usecase/listTasks";
import { handleCompleteTask, handleCompleteSelect } from "@/usecase/completeTask";
import { handleHelp } from "@/usecase/help";

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
});

const WebhookBodySchema = v.object({
  destination: v.string(),
  events: v.array(LineEventSchema),
});

type ValidatedWebhookBody = v.InferOutput<typeof WebhookBodySchema>;

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
    console.error("Webhookボディのパース失敗:", parseResult.issues);
    return c.text("OK", 200); // LINEには常に200を返す
  }

  // 即座に200を返し、処理は非同期で継続
  processEvents(parseResult.output).catch((err) => {
    console.error("Webhookイベント処理エラー:", err);
  });

  return c.text("OK", 200);
});

async function processEvents(body: ValidatedWebhookBody): Promise<void> {
  // テキストメッセージイベントのみ抽出して並列処理
  const tasks = body.events
    .filter(
      (e) =>
        e.type === "message" &&
        e.message?.type === "text" &&
        e.replyToken &&
        e.source.userId &&
        e.message.text
    )
    .map((e) => handleMessage(e.message!.text!, e.source.userId!, e.replyToken!));

  await Promise.all(tasks);
}

async function handleMessage(text: string, lineUserId: string, replyToken: string): Promise<void> {
  try {
    const command = await parseCommand(text);

    switch (command.type) {
      case "add":
        await handleAddTask(command, lineUserId, replyToken);
        break;
      case "list":
        await handleListTasks(lineUserId, replyToken);
        break;
      case "complete":
        await handleCompleteTask(command, lineUserId, replyToken);
        break;
      case "complete_select":
        await handleCompleteSelect(command, lineUserId, replyToken);
        break;
      case "help":
        await handleHelp(replyToken);
        break;
    }
  } catch (err) {
    console.error("メッセージ処理エラー:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const reply = msg.toLowerCase().includes("linear")
      ? "⚠️ タスク管理サービスとの通信でエラーが発生しました。時間をおいて再度お試しください"
      : undefined;

    await (reply ? replyMessage(replyToken, reply) : handleHelp(replyToken)).catch(console.error);
  }
}
