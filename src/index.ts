import { env } from "@/config/env";
import { remindRouter } from "@/presentation/remind";
import { webhookRouter } from "@/presentation/webhook";
import { logger } from "@/utils/logger";
import { Hono } from "hono";

const app = new Hono();

app.route("/", webhookRouter);
app.route("/", remindRouter);

app.get("/health", (c) => c.json({ status: "ok" }));

const port = Number.parseInt(env.PORT, 10);

const server = Bun.serve({ port, fetch: app.fetch });
logger.info({ port }, "サーバーを起動しました");

// グレースフルシャットダウン（Cloud Run の SIGTERM に対応）
const shutdown = () => {
  logger.info("シャットダウンを開始します");
  server.stop(); // 新規接続の受付を停止、既存コネクションは維持
  // Cloud Run のデフォルト終了タイムアウト（10秒）に合わせて待機
  setTimeout(() => process.exit(0), 10_000);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
