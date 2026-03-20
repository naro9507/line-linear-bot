# line-linear-bot

LINE Bot × Linear タスク管理ボット。LINEのメッセージを Gemini AI で解析し、Linear の Issue 操作（追加・一覧・完了）とリマインド通知を行う。

## 機能

- **タスク追加**: 自然言語でタスクを Linear に登録
- **タスク一覧**: 自分のアサインタスクを LINE に表示
- **タスク完了**: キーワード or 識別子（ENG-1 形式）でタスクを完了
- **リマインド**: Cloud Scheduler からの定期通知に対応

## アーキテクチャ

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

## セットアップ

```bash
git clone <repository-url>
cd line-linear-bot

# 環境変数を設定（下記「環境変数」セクション参照）
cp .env.example .env  # または直接 .env を作成

bun install
bun run dev
```

## 環境変数

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

LINE ↔ Linear のユーザー対応を `USER_MAP_JSON` 環境変数に JSON で設定する。

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

## 開発コマンド

```bash
bun run dev        # 開発サーバー（watch mode）
bun run start      # 本番起動
bun run build      # バンドル（dist/）
bun run check      # Biome lint/format チェック
bun run check:fix  # Biome 自動修正
bun test           # テスト実行
```

## デプロイ

Cloud Run へのデプロイを想定している。リマインド通知は Cloud Scheduler から `/remind` エンドポイントを定期的に叩く構成。

```
Cloud Scheduler → POST /remind  (Authorization: REMIND_SECRET)
LINE Platform   → POST /webhook (X-Line-Signature 検証)
```

## 技術スタック

| カテゴリ | ライブラリ |
|---|---|
| ランタイム | [Bun](https://bun.sh) |
| Web フレームワーク | [Hono](https://hono.dev) |
| AI | [Gemini API](https://ai.google.dev) |
| タスク管理 | [Linear SDK](https://developers.linear.app) |
| メッセージング | [LINE Bot SDK](https://developers.line.biz) |
| バリデーション | [Valibot](https://valibot.dev) |
| Lint/Format | [Biome](https://biomejs.dev) |
| テスト | [bun:test](https://bun.sh/docs/cli/test) |
