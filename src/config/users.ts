import { env } from "@/config/env";
import type { UserMapping } from "@/domain/types";

// USER_MAP_JSON 環境変数からユーザーマッピングを注入する
// 例: '[{"lineUserId":"U...","linearUserId":"xxx...","displayName":"山田","aliases":["yamada","@yamada"]}]'
let parsedUserMap: UserMapping[];
try {
  parsedUserMap = JSON.parse(env.USER_MAP_JSON) as UserMapping[];
} catch {
  throw new Error("USER_MAP_JSON の JSON パースに失敗しました");
}

export const USER_MAP: UserMapping[] = parsedUserMap;

// LINEユーザーIDからマッピングを取得
export function getUserByLineId(lineUserId: string): UserMapping | undefined {
  return USER_MAP.find((u) => u.lineUserId === lineUserId);
}

// エイリアスからマッピングを取得
export function getUserByAlias(alias: string): UserMapping | undefined {
  return USER_MAP.find((u) => u.aliases.includes(alias));
}

// LinearユーザーIDからマッピングを取得
export function getUserByLinearId(linearUserId: string): UserMapping | undefined {
  return USER_MAP.find((u) => u.linearUserId === linearUserId);
}
