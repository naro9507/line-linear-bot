---
paths:
  - "src/**/*.ts"
---

## 重要な実装パターン

**LINE Webhook**
- 受信後すぐ `200 OK` を返す（LINEのタイムアウト対策）
- イベント処理は `processEvents()` で非同期継続、複数イベントは `Promise.all` で並列処理
- 署名検証は `crypto.subtle`（Bun組み込み）で行う（`infrastructure/signature.ts`）

**Gemini コマンド解析**
- 全メッセージを Gemini に渡して JSON コマンドに変換（キーワードマッチは使わない）
- 解析失敗・バリデーション失敗時は `{ type: "help" }` にフォールバック

**タスク完了の候補選択**
- 複数候補ヒット時は `Map<lineUserId, { issues, expiresAt }>` でセッション管理
- TTL 10分。`completeTask.ts` の `getCandidates()` / `setCandidates()` を使う

**JST 日付**
- `utils/date.ts` の `getJSTDateString(offsetDays?)` と `parseJSTDate(dateStr)` を必ず使う
- 直接 `Date.now() + 9 * 60 * 60 * 1000` と書かない

**Linear GraphQL**
- クエリは `infrastructure/linear.ts` 内の `gql` タグ関数で記述（エディタのシンタックスハイライト対応）
- イシューフィールドは `ISSUE_FIELDS` 定数を使う（重複しない）

**エラーハンドリング**
- Linear API エラー → `⚠️ タスク管理サービスとの通信でエラーが発生しました...`
- ユーザー未登録 → `utils/messages.ts` の `USER_NOT_FOUND_MESSAGE` 定数を使う
- Gemini エラー → help にフォールバック（`usecase/parseCommand.ts`）

**外部入力のバリデーション**
- HTTP ボディ（Webhook）は Valibot の `v.looseObject` スキーマで検証する
- `as SomeType` による unsafe cast は禁止
