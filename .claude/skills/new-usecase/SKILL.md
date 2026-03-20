---
name: new-usecase
description: LINE × Linear botに新しいコマンドタイプを追加する手順をガイドする
disable-model-invocation: true
argument-hint: <command-name>
---

Guide me through adding a new command type to this LINE × Linear bot.

The command name/type to add is: $ARGUMENTS

Follow this checklist in order:

1. **`src/domain/types.ts`** — Add the new command type to the `Command` union type.

2. **`src/infrastructure/gemini.ts`** — Update in two places:
   - Add the new type to `CommandSchema` (Valibot union)
   - Add a description of the new command to `SYSTEM_PROMPT`

3. **`src/usecase/<name>.ts`** — Create a new handler file following this pattern:
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

4. **`src/presentation/webhook.ts`** — Add a case to the `switch (command.type)` block.

5. **`src/presentation/formatMessage.ts`** — Add a formatter function for the new command's reply message.

After each step, run `/check` to ensure no lint errors were introduced.
