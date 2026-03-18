import { Hono } from "hono";
import { env } from "@/config/env";
import { runReminder } from "@/usecase/remind";

export const remindRouter = new Hono();

remindRouter.post("/remind", async (c) => {
  const token = (c.req.header("Authorization") ?? "").replace("Bearer ", "");
  if (token !== env.REMIND_SECRET) return c.text("Unauthorized", 401);

  try {
    await runReminder();
    return c.json({ success: true });
  } catch (err) {
    console.error("リマインド処理エラー:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});
