# CLAUDE.md

LINE Bot × Linear タスク管理ボット。LINEのメッセージをGemini AIで解析し、LinearのIssue操作（追加・一覧・完了）とリマインド通知を行う。

## 開発コマンド

```bash
bun run dev        # 開発サーバー（watch mode）
bun run start      # 本番起動
bun run check      # Biome lint/format チェック
bun run check:fix  # Biome 自動修正
```

## アーキテクチャ

`src/` は薄いレイヤードアーキテクチャ。依存の向きは一方向のみ。

```
presentation/   HTTPルーター・メッセージ整形
    ↓
usecase/        ビジネスロジック（タスク操作・リマインド）
    ↓
infrastructure/ 外部API呼び出し（LINE / Linear / Gemini）
domain/         型定義のみ（types.ts）

config/         環境変数・ユーザーマッピング  ← 全層から参照可
utils/          共通ユーティリティ            ← 全層から参照可
```

**上位層から下位層への参照のみ許可。逆方向の参照は禁止。**

## import ルール

`@/` 絶対パスエイリアスを必ず使う。相対パス（`../`）は禁止。

```typescript
import { env } from "@/config/env";
import { replyMessage } from "@/infrastructure/line";
import type { Command } from "@/domain/types";
```

## コーディング規約

Biomeで強制されるもの:
- インデント: スペース2つ
- クォート: ダブルクォート
- セミコロン: 必須
- `any` 型: 禁止（`noExplicitAny: error`）
- 行長: 100文字

命名:
- 関数・変数: `camelCase`
- 型・インターフェース: `PascalCase`
- 定数: `UPPER_SNAKE_CASE`

## 環境変数

`src/config/env.ts` で Valibot により起動時に全検証。未設定の必須変数があると即 throw。

| 変数名 | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `LINE_CHANNEL_SECRET` | ✅ | — | LINE署名検証 |
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | — | LINE API認証 |
| `LINEAR_API_KEY` | ✅ | — | Linear API認証 |
| `LINEAR_TEAM_ID` | ✅ | — | LinearチームID |
| `REMIND_SECRET` | ✅ | — | Cloud Scheduler認証 |
| `GEMINI_API_KEY` | ✅ | — | Gemini API認証 |
| `GEMINI_MODEL` | — | `gemini-2.0-flash` | 使用モデル |
| `USER_MAP_JSON` | — | `[]` | ユーザーマッピングJSON |
| `PORT` | — | `8080` | リッスンポート |

## ユーザーマッピング

LINE ↔ Linear のユーザー対応は `USER_MAP_JSON` 環境変数に JSON で設定する。
`config/users.ts` 起動時に3つの Map インデックス（byLineId / byLinearId / byAlias）を構築し O(1) で検索。

```json
[
  {
    "lineUserId": "U...",
    "linearUserId": "uuid...",
    "displayName": "山田",
    "aliases": ["yamada", "@yamada"]
  }
]
```

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

## インフラ

```
アプリ CD:  git push main → Cloud Build (cloudbuild.yaml) → Artifact Registry → Cloud Run
インフラ CD: GitHub Actions (infra.yml) 手動実行 → pulumi preview → 承認 → pulumi up
```

**シークレット管理（Pulumi Config Secrets）**

```bash
cd infra
pulumi config set --secret line-linear-bot-infra:line-channel-secret "xxx"
# → Pulumi.prod.yaml に暗号化されて保存
# → pulumi up 時に Secret Manager に自動反映
```

`infra/` は独立した Node.js プロジェクト（Pulumi が Bun 非対応のため）。
アプリ本体の `package.json` / `node_modules` とは別管理。
