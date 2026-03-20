---
name: new-usecase
description: LINE × Linear botに新しいコマンドタイプを追加する手順をガイドする
disable-model-invocation: true
argument-hint: <command-name>
---

このLINE × Linear botに新しいコマンドタイプを追加する手順をガイドする。

追加するコマンド名: $ARGUMENTS

以下のチェックリストを順番に実施する：

1. **`src/domain/types.ts`** — `Command` ユニオン型に新しいコマンド型を追加する。

2. **`src/infrastructure/gemini.ts`** — 2箇所を更新する：
   - `CommandSchema`（Valibot union）に新しい型を追加する
   - `SYSTEM_PROMPT` に新しいコマンドの説明を追加する

3. **`src/usecase/<name>.ts`** — 以下のパターンで新しいハンドラファイルを作成する：
   ```typescript
   import { getUserByLineId } from "@/config/users";
   import type { Command } from "@/domain/types";
   import { replyMessage } from "@/infrastructure/line";
   import { USER_NOT_FOUND_MESSAGE } from "@/utils/messages";

   export async function handle<Name>(
     command: Extract<Command, { type: "<name>" }>,
     lineUserId: string,
     replyToken: string
   ): Promise<void> {
     // implementation
   }
   ```

4. **`src/presentation/webhook.ts`** — `switch (command.type)` ブロックにケースを追加する。

5. **`src/presentation/formatMessage.ts`** — 新しいコマンドの返信メッセージ用フォーマッター関数を追加する。

各ステップ後に `/check` を実行してlintエラーが発生していないことを確認する。
