// コマンド型定義
export type Command =
  | { type: "add"; title: string; dueDate?: string | null; assignee?: string | null; priority?: number | null }
  | { type: "list" }
  | { type: "complete"; query: string }
  | { type: "complete_select"; index: number }
  | { type: "help" }

// LINEユーザー ↔ Linearユーザーのマッピング
export interface UserMapping {
  lineUserId: string
  linearUserId: string
  displayName: string
  aliases: string[]
}

// Linearイシューの型
export interface LinearIssue {
  id: string
  identifier: string
  title: string
  state: { name: string; type: string }
  dueDate: string | null
  priority: number
  assignee?: { id: string; name: string }
  url: string
}
