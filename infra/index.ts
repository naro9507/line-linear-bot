import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const config = new pulumi.Config();
const gcpConfig = new pulumi.Config("gcp");

const project = gcpConfig.require("project");
const region = gcpConfig.get("region") ?? "asia-northeast1";
const imageTag = config.get("imageTag") ?? "latest";

// ---- Artifact Registry ----

const registry = new gcp.artifactregistry.Repository("registry", {
  repositoryId: "line-linear-bot",
  location: region,
  format: "DOCKER",
  description: "LINE Bot × Linear app images",
});

const imageBase = pulumi.interpolate`${region}-docker.pkg.dev/${project}/${registry.repositoryId}/app`;
const image = pulumi.interpolate`${imageBase}:${imageTag}`;

// ---- Service Accounts ----

// Cloud Run が使うサービスアカウント
const runSa = new gcp.serviceaccount.Account("cloud-run-sa", {
  accountId: "line-linear-bot-run",
  displayName: "LINE Linear Bot - Cloud Run",
});

// Cloud Scheduler が使うサービスアカウント
const schedulerSa = new gcp.serviceaccount.Account("scheduler-sa", {
  accountId: "line-linear-bot-scheduler",
  displayName: "LINE Linear Bot - Cloud Scheduler",
});

// ---- Secret Manager ----

// シークレットのキー名一覧（値は gcloud secrets versions add で手動登録）
const secretNames = [
  "LINE_CHANNEL_SECRET",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "LINEAR_API_KEY",
  "LINEAR_TEAM_ID",
  "REMIND_SECRET",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "USER_MAP_JSON",
] as const;

const secrets = Object.fromEntries(
  secretNames.map((name) => [
    name,
    new gcp.secretmanager.Secret(name.toLowerCase().replace(/_/g, "-"), {
      secretId: name,
      replication: { auto: {} },
    }),
  ])
) as Record<(typeof secretNames)[number], gcp.secretmanager.Secret>;

// Cloud Run SA に全シークレットへのアクセス権を付与
for (const [name, secret] of Object.entries(secrets)) {
  new gcp.secretmanager.SecretIamMember(`secret-access-${name}`, {
    secretId: secret.secretId,
    role: "roles/secretmanager.secretAccessor",
    member: pulumi.interpolate`serviceAccount:${runSa.email}`,
  });
}

// ---- Cloud Run ----

// Secret Manager 参照を env 変数として組み立てる
const secretEnvVars = secretNames.map((name) => ({
  name,
  valueSource: {
    secretKeyRef: {
      secret: secrets[name].secretId,
      version: "latest",
    },
  },
}));

const cloudRunService = new gcp.cloudrunv2.Service("cloud-run", {
  name: "line-linear-bot",
  location: region,
  template: {
    serviceAccount: runSa.email,
    containers: [
      {
        image,
        envs: secretEnvVars,
        resources: {
          limits: { cpu: "1", memory: "512Mi" },
        },
        ports: [{ containerPort: 8080 }],
      },
    ],
  },
});

// パブリックアクセスを許可（LINE Webhookからの受信のため）
new gcp.cloudrunv2.ServiceIamMember("cloud-run-public", {
  name: cloudRunService.name,
  location: region,
  role: "roles/run.invoker",
  member: "allUsers",
});

// ---- Cloud Scheduler ----

// Scheduler SA に Cloud Run の起動権限を付与
new gcp.cloudrunv2.ServiceIamMember("cloud-run-scheduler-invoker", {
  name: cloudRunService.name,
  location: region,
  role: "roles/run.invoker",
  member: pulumi.interpolate`serviceAccount:${schedulerSa.email}`,
});

// 毎日 9:00 JST（= 00:00 UTC）に /remind を呼ぶ
new gcp.cloudscheduler.Job("remind-job", {
  name: "line-linear-bot-remind",
  region,
  schedule: "0 0 * * *",
  timeZone: "Asia/Tokyo",
  httpTarget: {
    uri: pulumi.interpolate`${cloudRunService.uri}/remind`,
    httpMethod: "POST",
    oidcToken: {
      serviceAccountEmail: schedulerSa.email,
      audience: cloudRunService.uri,
    },
    // REMIND_SECRET は Cloud Run 内で検証するため不要
    // （OIDC トークンによるサービス間認証で保護）
  },
});

// ---- Outputs ----

export const serviceUrl = cloudRunService.uri;
export const registryUrl = imageBase;
