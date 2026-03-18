import { getRemindIssues } from "@/infrastructure/linear";
import { pushMessage } from "@/infrastructure/line";
import { getUserByLinearId } from "@/config/users";
import type { LinearIssue } from "@/domain/types";

// 今日/明日の日付をJSTで取得
function getJSTDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0]!;
}

function buildRemindMessage(todayIssues: LinearIssue[], tomorrowIssues: LinearIssue[]): string {
  const today = getJSTDate();
  const d = new Date(`${today}T00:00:00+09:00`);
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;

  let msg = `⏰ おはようございます！（${dateStr}）`;

  if (todayIssues.length > 0) {
    msg += `\n\n🔥 今日が期限：`;
    for (const issue of todayIssues) {
      msg += `\n  [${issue.identifier}] ${issue.title}`;
    }
  }

  if (tomorrowIssues.length > 0) {
    msg += `\n\n⚠️ 明日が期限：`;
    for (const issue of tomorrowIssues) {
      msg += `\n  [${issue.identifier}] ${issue.title}`;
    }
  }

  return `${msg}\n\n今日もがんばりましょう 💪`;
}

export async function runReminder(): Promise<void> {
  const issues = await getRemindIssues();
  if (issues.length === 0) return;

  const today = getJSTDate();
  const tomorrow = getJSTDate(1);

  // LinearユーザーIDごとにグルーピング
  const byUser = new Map<string, { today: LinearIssue[]; tomorrow: LinearIssue[] }>();

  for (const issue of issues) {
    if (!issue.assignee) continue;
    const uid = issue.assignee.id;
    if (!byUser.has(uid)) byUser.set(uid, { today: [], tomorrow: [] });
    const entry = byUser.get(uid)!;
    if (issue.dueDate === today) entry.today.push(issue);
    else if (issue.dueDate === tomorrow) entry.tomorrow.push(issue);
  }

  for (const [linearUserId, { today: t, tomorrow: tm }] of byUser) {
    if (t.length === 0 && tm.length === 0) continue;
    const mapping = getUserByLinearId(linearUserId);
    if (!mapping) continue;
    await pushMessage(mapping.lineUserId, buildRemindMessage(t, tm));
  }
}
