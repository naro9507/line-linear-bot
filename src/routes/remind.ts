import { Hono } from "hono"
import { env } from "../config/env.js"
import { runReminder } from "../services/reminder.js"

export const remindRouter = new Hono()

remindRouter.post("/remind", async (c) => {
  // Authorization: Bearer {REMIND_SECRET} で認証
  const authHeader = c.req.header("Authorization") ?? ""
  const token = authHeader.replace("Bearer ", "")

  if (token !== env.REMIND_SECRET) {
    return c.text("Unauthorized", 401)
  }

  try {
    await runReminder()
    return c.json({ success: true })
  } catch (err) {
    console.error("リマインド処理エラー:", err)
    return c.json({ success: false, error: String(err) }, 500)
  }
})
