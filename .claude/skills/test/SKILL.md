---
name: test
description: bun testを実行してテスト結果を確認し、失敗があれば原因を分析する
disable-model-invocation: true
allowed-tools: Bash(bun:*)
---

`bun test` を実行してテスト結果を表示する。
テストが失敗した場合は、失敗メッセージを分析して根本原因を特定し、修正方法を提案する。
すべてのテストが通過した場合は、パスしたテスト数を報告する。
