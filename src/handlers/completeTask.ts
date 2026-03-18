import { getIssueByIdentifier, searchIssues, completeIssue } from "../services/linear.js"
import { replyMessage } from "../services/line.js"
import { getUserByLineId } from "../config/users.js"
import { formatCompleteTaskMessage, formatCandidatesMessage } from "../utils/formatMessage.js"
import type { Command } from "../types/index.js"
import type { LinearIssue } from "../types/index.js"

// ユーザーごとの完了候補タスクをセッション管理するMap
// key: lineUserId, value: 候補リスト
const completeCandidatesMap = new Map<string, LinearIssue[]>()

// タスク完了コマンドを処理する
export async function handleCompleteTask(
  command: Extract<Command, { type: "complete" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const userMapping = getUserByLineId(lineUserId)
  if (!userMapping) {
    await replyMessage(
      replyToken,
      "⚠️ あなたのアカウントがまだ登録されていません。管理者に連絡してください"
    )
    return
  }

  // 識別子パターン（例: ENG-42）かどうか判定
  const identifierPattern = /^[A-Z]+-\d+$/i
  let candidates: LinearIssue[]

  if (identifierPattern.test(command.query)) {
    // 識別子で直接取得
    const issue = await getIssueByIdentifier(command.query)
    if (!issue) {
      await replyMessage(replyToken, `⚠️ タスク [${command.query}] が見つかりませんでした`)
      return
    }
    candidates = [issue]
  } else {
    // キーワードで検索
    candidates = await searchIssues(command.query)
    if (candidates.length === 0) {
      await replyMessage(replyToken, `⚠️ 「${command.query}」に該当するタスクが見つかりませんでした`)
      return
    }
  }

  if (candidates.length === 1) {
    // 一意に特定できた場合は完了処理
    const completed = await completeIssue(candidates[0]!.id)
    completeCandidatesMap.delete(lineUserId)
    await replyMessage(replyToken, formatCompleteTaskMessage(completed))
  } else {
    // 複数候補がある場合はセッションに保存して選択を促す
    completeCandidatesMap.set(lineUserId, candidates)
    await replyMessage(replyToken, formatCandidatesMessage(candidates))
  }
}

// 番号選択コマンドを処理する（候補から選択して完了）
export async function handleCompleteSelect(
  command: Extract<Command, { type: "complete_select" }>,
  lineUserId: string,
  replyToken: string
): Promise<void> {
  const candidates = completeCandidatesMap.get(lineUserId)
  if (!candidates || candidates.length === 0) {
    await replyMessage(replyToken, "⚠️ 選択対象のタスクがありません。まず「完了 キーワード」で検索してください")
    return
  }

  const index = command.index - 1  // 1始まりを0始まりに変換
  if (index < 0 || index >= candidates.length) {
    await replyMessage(replyToken, `⚠️ 無効な番号です。1〜${candidates.length}の番号を入力してください`)
    return
  }

  const issue = candidates[index]!
  const completed = await completeIssue(issue.id)
  completeCandidatesMap.delete(lineUserId)
  await replyMessage(replyToken, formatCompleteTaskMessage(completed))
}
