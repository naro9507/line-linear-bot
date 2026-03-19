---
paths:
  - "src/**/*.ts"
---

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
