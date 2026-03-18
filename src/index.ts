import { Hono } from "hono"
import { env } from "./config/env.js"
import { webhookRouter } from "./routes/webhook.js"
import { remindRouter } from "./routes/remind.js"

// Honoアプリケーションの初期化
const app = new Hono()

// ルーティング
app.route("/", webhookRouter)
app.route("/", remindRouter)

// ヘルスチェック
app.get("/health", (c) => c.json({ status: "ok" }))

// サーバー起動
const port = parseInt(env.PORT ?? "8080", 10)
console.log(`サーバーを起動します: port ${port}`)

export default {
  port,
  fetch: app.fetch,
}
