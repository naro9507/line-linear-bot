import type { UserMapping } from "../types/index.js"

// LINE ↔ Linear ユーザーマッピング
// 実際のユーザー情報に合わせて更新すること
export const USER_MAP: UserMapping[] = [
  {
    lineUserId: "U1234567890abcdef",
    linearUserId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    displayName: "山田",
    aliases: ["yamada", "@yamada"],
  },
]

// LINEユーザーIDからマッピングを取得
export function getUserByLineId(lineUserId: string): UserMapping | undefined {
  return USER_MAP.find((u) => u.lineUserId === lineUserId)
}

// エイリアスからマッピングを取得
export function getUserByAlias(alias: string): UserMapping | undefined {
  return USER_MAP.find((u) => u.aliases.includes(alias))
}

// LinearユーザーIDからマッピングを取得
export function getUserByLinearId(linearUserId: string): UserMapping | undefined {
  return USER_MAP.find((u) => u.linearUserId === linearUserId)
}
