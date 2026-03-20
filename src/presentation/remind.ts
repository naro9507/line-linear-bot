import { env } from "@/config/env";
import { userRepository } from "@/config/users";
import { lineRepository } from "@/infrastructure/line";
import { linearRepository } from "@/infrastructure/linear";
import { runReminder } from "@/usecase/remind";
import { logger } from "@/utils/logger";
import { Hono } from "hono";

export const remindRouter = new Hono();

remindRouter.post("/remind", async (c) => {
  const token = (c.req.header("Authorization") ?? "").replace("Bearer ", "");
  if (token !== env.REMIND_SECRET) return c.text("Unauthorized", 401);

  try {
    await runReminder({
      line: lineRepository,
      linear: linearRepository,
      users: userRepository,
    });
    return c.json({ success: true });
  } catch (err) {
    logger.error({ err }, "リマインド処理エラー");
    return c.json({ success: false, error: String(err) }, 500);
  }
});
