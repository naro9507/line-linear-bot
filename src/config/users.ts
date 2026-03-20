import { env } from "@/config/env";
import type { UserRepository } from "@/domain/repositories";
import type { UserMapping } from "@/domain/types";

// USER_MAP_JSON 環境変数からユーザーマッピングを注入する
// 例: '[{"lineUserId":"U...","linearUserId":"xxx...","displayName":"山田","aliases":["yamada","@yamada"]}]'
let parsed: UserMapping[];
try {
  parsed = JSON.parse(env.USER_MAP_JSON) as UserMapping[];
} catch (e) {
  throw new Error(
    `USER_MAP_JSON の JSON パースに失敗しました: ${e instanceof Error ? e.message : String(e)}`
  );
}

export const USER_MAP: UserMapping[] = parsed;

// O(1) ルックアップ用インデックス（起動時に一度だけ構築）
const byLineId = new Map<string, UserMapping>();
const byLinearId = new Map<string, UserMapping>();
const byAlias = new Map<string, UserMapping>();

for (const user of USER_MAP) {
  byLineId.set(user.lineUserId, user);
  byLinearId.set(user.linearUserId, user);
  for (const alias of user.aliases) {
    byAlias.set(alias, user);
  }
}

export const getUserByLineId = (lineUserId: string): UserMapping | undefined =>
  byLineId.get(lineUserId);

export const getUserByAlias = (alias: string): UserMapping | undefined => byAlias.get(alias);

export const getUserByLinearId = (linearUserId: string): UserMapping | undefined =>
  byLinearId.get(linearUserId);

export const userRepository = {
  getUserByLineId,
  getUserByLinearId,
  getUserByAlias,
} satisfies UserRepository;
