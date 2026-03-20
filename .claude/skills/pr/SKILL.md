---
name: pr
description: 現在のブランチからPull Requestを作成する。変更内容を要約してPRテンプレートに沿った日本語の説明を生成し、gh pr create でPRを作成する。
argument-hint: [base-branch]
allowed-tools: Bash(git *), Bash(gh *)
---

現在のブランチからPull Requestを作成する。

ベースブランチ: $ARGUMENTS（省略時は `main`）

以降、BASE=$ARGUMENTS（省略時は main）として扱う。

## 手順

### 1. 変更内容を把握する

以下を実行してコミット履歴と変更ファイルを確認する。

- git log $BASE..HEAD --oneline
- git diff $BASE..HEAD --stat

### 2. チェックを通過させる

`bun run check` を実行してlint/formatエラーがないことを確認する。
エラーがあれば `/check` で修正してからPRを作成する。

### 3. PRの内容を決定する

変更内容をもとに以下を日本語で決定する：

- **タイトル**: 変更内容を端的に表す（例: `feat: タスク完了コマンドを追加`）
- **概要**: 何を・なぜ変更したかを2〜3文で説明
- **変更内容**: 主な変更点をリストアップ
- **その他**: レビュアーへの補足事項があれば記載

### 4. pushしてPRを作成する

`git push -u origin HEAD` を実行してリモートにpushする。

続いて以下を実行してPRを作成する。
タイトルと本文は手順3で決定した内容を埋めて実行する：

```bash
gh pr create \
  --base $BASE \
  --title "<決定したタイトル>" \
  --body "$(cat <<'EOF'
## 概要

<概要>

## 変更内容

<変更点リスト>

## その他

<補足事項、なければ省略>
EOF
)"
```

作成されたPRのURLをユーザーに伝える。
