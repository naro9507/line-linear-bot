---
paths:
  - "infra/**"
  - "cloudbuild.yaml"
  - ".github/**"
---

## インフラ

```
アプリ CD:  git push main → Cloud Build (cloudbuild.yaml) → Artifact Registry → Cloud Run
インフラ CD: GitHub Actions (infra.yml) 手動実行 → pulumi preview → 承認 → pulumi up
```

**シークレット管理（Pulumi Config Secrets）**

```bash
cd infra
pulumi config set --secret line-linear-bot-infra:line-channel-secret "xxx"
# → Pulumi.prod.yaml に暗号化されて保存
# → pulumi up 時に Secret Manager に自動反映
```

`infra/` は独立した Node.js プロジェクト（Pulumi が Bun 非対応のため）。
アプリ本体の `package.json` / `node_modules` とは別管理。
