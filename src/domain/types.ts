// コマンド型定義
export type Command =
  | { type: "add" }
  | { type: "list" }
  | { type: "complete"; query: string }
  | { type: "complete_select"; index: number }
  | { type: "update"; query: string }
  | { type: "update_select"; index: number }
  | { type: "help" };

// Quick Reply ボタン1項目
export interface QuickReplyItem {
  label: string;
  postbackData: string;
}

// LINEユーザー ↔ Linearユーザーのマッピング
export interface UserMapping {
  lineUserId: string;
  linearUserId: string;
  displayName: string;
  aliases: string[];
}

// Linearイシューの型
export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  state: { name: string; type: string };
  dueDate: string | null;
  priority: number;
  assignee?: { id: string; name: string };
  url: string;
}
