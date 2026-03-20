import type { LineRepository, LinearRepository, UserRepository } from "@/domain/repositories";
import type { LinearIssue } from "@/domain/types";
import { getJSTDateString, parseJSTDate } from "@/utils/date";

type ReminderDeps = {
  line: Pick<LineRepository, "pushMessage">;
  linear: Pick<LinearRepository, "getRemindIssues">;
  users: Pick<UserRepository, "getUserByLinearId">;
};

function buildRemindMessage(todayIssues: LinearIssue[], tomorrowIssues: LinearIssue[]): string {
  const todayStr = getJSTDateString();
  const d = parseJSTDate(todayStr);
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;

  let msg = `⏰ おはようございます！（${dateStr}）`;

  if (todayIssues.length > 0) {
    msg += "\n\n🔥 今日が期限：";
    for (const issue of todayIssues) {
      msg += `\n  [${issue.identifier}] ${issue.title}`;
    }
  }

  if (tomorrowIssues.length > 0) {
    msg += "\n\n⚠️ 明日が期限：";
    for (const issue of tomorrowIssues) {
      msg += `\n  [${issue.identifier}] ${issue.title}`;
    }
  }

  return `${msg}\n\n今日もがんばりましょう 💪`;
}

export async function runReminder(deps: ReminderDeps): Promise<void> {
  const issues = await deps.linear.getRemindIssues();
  if (issues.length === 0) return;

  const today = getJSTDateString();
  const tomorrow = getJSTDateString(1);

  // LinearユーザーIDごとにグルーピング
  const byUser = new Map<string, { today: LinearIssue[]; tomorrow: LinearIssue[] }>();

  for (const issue of issues) {
    if (!issue.assignee) continue;
    const uid = issue.assignee.id;
    if (!byUser.has(uid)) byUser.set(uid, { today: [], tomorrow: [] });
    // biome-ignore lint/style/noNonNullAssertion: uid は直前の has() で存在確認済み
    const entry = byUser.get(uid)!;
    if (issue.dueDate === today) entry.today.push(issue);
    else if (issue.dueDate === tomorrow) entry.tomorrow.push(issue);
  }

  // 各ユーザーへ並列で通知を送信
  await Promise.all(
    Array.from(byUser).map(([linearUserId, { today: t, tomorrow: tm }]) => {
      if (t.length === 0 && tm.length === 0) return Promise.resolve();
      const mapping = deps.users.getUserByLinearId(linearUserId);
      if (!mapping) return Promise.resolve();
      return deps.line.pushMessage(mapping.lineUserId, buildRemindMessage(t, tm));
    })
  );
}
