---
name: check
description: Biome lint/formatチェックを実行し、フォーマットエラーは自動修正、lintエラーは適切に対応する
disable-model-invocation: true
allowed-tools: Bash(bun:*)
---

まず `bun run check` を実行して結果を確認する。

**フォーマットエラーがある場合：**
`bun run check:fix` で自動修正する。

**lintエラーがある場合：**
エラーの内容を読んで状況に応じて対応する。
- 型エラーは正しい型を推論・定義して解決する。`any` や `unknown` で無理やり解決しない（ただし、本当に必要な場面では使用してよい）
- その他のlintエラーはコードを適切に修正する
- 自動修正できないものは修正内容を説明する

**エラーがない場合：**
すべてのチェックがパスしたことを確認して報告する。
