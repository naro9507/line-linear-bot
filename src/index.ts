import { Hono } from "hono";
import { env } from "@/config/env";
import { webhookRouter } from "@/presentation/webhook";
import { remindRouter } from "@/presentation/remind";

const app = new Hono();

app.route("/", webhookRouter);
app.route("/", remindRouter);

app.get("/health", (c) => c.json({ status: "ok" }));

const port = Number.parseInt(env.PORT, 10);
console.log(`サーバーを起動します: port ${port}`);

export default { port, fetch: app.fetch };
