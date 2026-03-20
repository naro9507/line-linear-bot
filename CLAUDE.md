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

`src/` は薄いレイヤードアーキテクチャ。依存性逆転（DIP）により usecase は domain インターフェースのみに依存。

```
presentation/   HTTPルーター・メッセージ整形（composition root）
    ↓
usecase/        ビジネスロジック（タスク操作・リマインド）
    ↓
domain/         型定義・リポジトリインターフェース
    ↑
infrastructure/ 外部API実装（LINE / Linear / Gemini）

config/         環境変数・ユーザーマッピング  ← 全層から参照可
utils/          共通ユーティリティ            ← 全層から参照可
```

**usecase は domain のインターフェースのみに依存。infrastructure は domain インターフェースを実装（satisfies）。presentation がインスタンスを注入する。**

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

