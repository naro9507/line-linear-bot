.PHONY: setup setup-app setup-infra dev start build check check-fix test \
        infra-preview infra-up

# ---- セットアップ ----

## アプリ依存パッケージをインストール
setup-app:
	bun install

## インフラ依存パッケージをインストール
setup-infra:
	cd infra && npm install

## アプリ + インフラ を一括セットアップ
setup: setup-app setup-infra

# ---- アプリ ----

## 開発サーバー（watch mode）
dev:
	bun run dev

## 本番起動
start:
	bun run start

## distroless 用シングルバイナリをビルド
build:
	bun run build

## Biome lint/format チェック
check:
	bun run check

## Biome lint/format 自動修正
check-fix:
	bun run check:fix

## ユニットテスト実行
test:
	bun run test

# ---- インフラ (Pulumi) ----

## pulumi preview（差分確認）
infra-preview:
	cd infra && pulumi preview

## pulumi up（適用）
infra-up:
	cd infra && pulumi up
