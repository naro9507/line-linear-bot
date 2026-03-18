import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

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

// シークレットのキー名一覧
// 値は `pulumi config set --secret <KEY> <VALUE>` で管理する
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

type SecretName = (typeof secretNames)[number];

// Pulumi Config に設定されている場合はシークレットバージョンも作成する
// 未設定の場合はシェル（リソース定義）のみ作成し、値は後から追加可能
const secrets = Object.fromEntries(
  secretNames.map((name) => {
    const configKey = name.toLowerCase().replace(/_/g, "-");
    const secretValue = config.getSecret(configKey);

    const secret = new gcp.secretmanager.Secret(configKey, {
      secretId: name,
      replication: { auto: {} },
    });

    if (secretValue) {
      new gcp.secretmanager.SecretVersion(`${configKey}-version`, {
        secret: secret.id,
        secretData: secretValue,
      });
    }

    return [name, secret];
  })
) as Record<SecretName, gcp.secretmanager.Secret>;

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

// ---- Cloud Build ----

// Cloud Build SA に Artifact Registry への push 権限を付与
const cloudbuildSa = gcp.projects.getServiceIdentityOutput({
  project,
  service: "cloudbuild.googleapis.com",
});

new gcp.artifactregistry.RepositoryIamMember("cloudbuild-registry-push", {
  repository: registry.repositoryId,
  location: region,
  role: "roles/artifactregistry.writer",
  member: pulumi.interpolate`serviceAccount:${cloudbuildSa.email}`,
});

// Cloud Build SA に Cloud Run のデプロイ権限を付与
new gcp.projects.IAMMember("cloudbuild-run-deploy", {
  project,
  role: "roles/run.developer",
  member: pulumi.interpolate`serviceAccount:${cloudbuildSa.email}`,
});

// Cloud Build SA が Cloud Run SA を act-as できるように
new gcp.serviceaccount.IAMMember("cloudbuild-sa-user", {
  serviceAccountId: runSa.name,
  role: "roles/iam.serviceAccountUser",
  member: pulumi.interpolate`serviceAccount:${cloudbuildSa.email}`,
});

// main ブランチへの push で cloudbuild.yaml を実行するトリガー
const buildTrigger = new gcp.cloudbuild.Trigger("deploy-trigger", {
  name: "line-linear-bot-deploy",
  location: region,
  filename: "cloudbuild.yaml",
  github: {
    owner: config.require("githubOwner"),
    name: config.require("githubRepo"),
    push: { branch: "^main$" },
  },
  substitutions: {
    // cloudbuild.yaml 内で $PROJECT_ID と $SHORT_SHA は Cloud Build が自動で提供
  },
});

// ---- Outputs ----

export const serviceUrl = cloudRunService.uri;
export const registryUrl = imageBase;
export const buildTriggerId = buildTrigger.triggerId;
