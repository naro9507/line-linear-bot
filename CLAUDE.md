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

## 環境変数

`src/config/env.ts` で Valibot により起動時に全検証。未設定の必須変数があると即 throw。

| 変数名 | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `LINE_CHANNEL_SECRET` | ✅ | — | LINE署名検証 |
| `LINE_CHANNEL_ID` | ✅ | — | LINEチャネルID |
| `LINE_PRIVATE_KEY` | ✅ | — | RSA秘密鍵 PEM（または base64 エンコード済み） |
| `LINE_KEY_ID` | ✅ | — | LINE Developers Console に登録した kid |
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

