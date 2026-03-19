import * as v from "valibot";

// 環境変数のスキーマ定義
const EnvSchema = v.object({
  LINE_CHANNEL_SECRET: v.pipe(v.string(), v.minLength(1, "LINE_CHANNEL_SECRET is required")),
  LINE_CHANNEL_ID: v.pipe(v.string(), v.minLength(1, "LINE_CHANNEL_ID is required")),
  LINE_PRIVATE_KEY: v.pipe(v.string(), v.minLength(1, "LINE_PRIVATE_KEY is required")),
  LINE_KEY_ID: v.pipe(v.string(), v.minLength(1, "LINE_KEY_ID is required")),
  LINEAR_API_KEY: v.pipe(v.string(), v.minLength(1, "LINEAR_API_KEY is required")),
  LINEAR_TEAM_ID: v.pipe(v.string(), v.minLength(1, "LINEAR_TEAM_ID is required")),
  REMIND_SECRET: v.pipe(v.string(), v.minLength(1, "REMIND_SECRET is required")),
  GEMINI_API_KEY: v.pipe(v.string(), v.minLength(1, "GEMINI_API_KEY is required")),
  // Geminiモデル名（デフォルト: gemini-2.0-flash）
  GEMINI_MODEL: v.optional(v.string(), "gemini-2.0-flash"),
  // ユーザーマッピングJSON（外部から注入）
  USER_MAP_JSON: v.optional(v.string(), "[]"),
  PORT: v.optional(v.string(), "8080"),
});

// 環境変数を読み込み・バリデーションする
const result = v.safeParse(EnvSchema, {
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
  LINE_CHANNEL_ID: process.env.LINE_CHANNEL_ID,
  LINE_PRIVATE_KEY: process.env.LINE_PRIVATE_KEY,
  LINE_KEY_ID: process.env.LINE_KEY_ID,
  LINEAR_API_KEY: process.env.LINEAR_API_KEY,
  LINEAR_TEAM_ID: process.env.LINEAR_TEAM_ID,
  REMIND_SECRET: process.env.REMIND_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  USER_MAP_JSON: process.env.USER_MAP_JSON,
  PORT: process.env.PORT,
});

if (!result.success) {
  const errors = result.issues.map((i) => i.message).join(", ");
  throw new Error(`環境変数の設定が不正です: ${errors}`);
}

export const env = result.output;
