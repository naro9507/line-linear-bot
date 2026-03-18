import { Hono } from "hono"
import type { WebhookRequestBody, MessageEvent } from "@line/bot-sdk"
import { verifyLineSignature } from "../utils/signature.js"
import { parseCommand } from "../utils/parseCommand.js"
import { handleAddTask } from "../handlers/addTask.js"
import { handleListTasks } from "../handlers/listTasks.js"
import { handleCompleteTask, handleCompleteSelect } from "../handlers/completeTask.js"
import { handleHelp } from "../handlers/help.js"
import { replyMessage } from "../services/line.js"

export const webhookRouter = new Hono()

webhookRouter.post("/webhook", async (c) => {
  // リクエストボディを取得
  const rawBody = await c.req.text()
  const signature = c.req.header("x-line-signature") ?? ""

  // LINE署名を検証
  const isValid = await verifyLineSignature(rawBody, signature)
  if (!isValid) {
    return c.text("Forbidden", 403)
  }

  // LINE Platformへは即座に200を返す（タイムアウト対策）
  // 処理は非同期で継続する
  const body = JSON.parse(rawBody) as WebhookRequestBody

  // 非同期で処理（waitUntilがない環境でも動作するように）
  processWebhookEvents(body).catch((err) => {
    console.error("Webhookイベント処理エラー:", err)
  })

  return c.text("OK", 200)
})

// Webhookイベントを処理する
async function processWebhookEvents(body: WebhookRequestBody): Promise<void> {
  for (const event of body.events) {
    if (event.type !== "message") continue
    const msgEvent = event as MessageEvent
    if (msgEvent.message.type !== "text") continue
    if (!msgEvent.replyToken) continue

    const lineUserId = msgEvent.source.userId
    if (!lineUserId) continue

    const text = msgEvent.message.text
    const replyToken = msgEvent.replyToken

    await handleMessage(text, lineUserId, replyToken)
  }
}

// テキストメッセージを処理する
async function handleMessage(
  text: string,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  try {
    const command = await parseCommand(text)

    switch (command.type) {
      case "add":
        await handleAddTask(command, lineUserId, replyToken)
        break

      case "list":
        await handleListTasks(lineUserId, replyToken)
        break

      case "complete":
        await handleCompleteTask(command, lineUserId, replyToken)
        break

      case "complete_select":
        await handleCompleteSelect(command, lineUserId, replyToken)
        break

      case "help":
      default:
        await handleHelp(replyToken)
        break
    }
  } catch (err) {
    console.error("メッセージ処理エラー:", err)
    // Linear APIエラーのハンドリング
    const errorMessage = err instanceof Error ? err.message : String(err)
    if (errorMessage.includes("Linear") || errorMessage.includes("linear")) {
      await replyMessage(
        replyToken,
        "⚠️ タスク管理サービスとの通信でエラーが発生しました。時間をおいて再度お試しください"
      ).catch(console.error)
    } else {
      await handleHelp(replyToken).catch(console.error)
    }
  }
}
