import { env } from "@/config/env";
import { messagingApi } from "@line/bot-sdk";
import { SignJWT, importPKCS8 } from "jose";

// ---- チャネルアクセストークン v2.1 ----

interface TokenCache {
  token: string;
  expiresAt: number; // ms
}

let tokenCache: TokenCache | null = null;

async function issueToken(): Promise<TokenCache> {
  const now = Math.floor(Date.now() / 1000);

  // base64 エンコードされた PEM も受け付ける（改行を含む PEM を env var に直接設定しにくい場合）
  const pem = env.LINE_PRIVATE_KEY.includes("-----")
    ? env.LINE_PRIVATE_KEY
    : atob(env.LINE_PRIVATE_KEY);

  const privateKey = await importPKCS8(pem, "RS256");

  const jwt = await new SignJWT({
    iss: env.LINE_CHANNEL_ID,
    sub: env.LINE_CHANNEL_ID,
    aud: "https://api.line.biz/",
    exp: now + 1800, // アサーション JWT の有効期限（30分）
    token_exp: 2592000, // 発行するトークンの有効期限（30日）
  })
    .setProtectedHeader({ alg: "RS256", kid: env.LINE_KEY_ID })
    .sign(privateKey);

  const res = await fetch("https://api.line.biz/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`LINE token API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
}

async function getToken(): Promise<string> {
  // 期限 1 分前に更新
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  tokenCache = await issueToken();
  return tokenCache.token;
}

// ---- LINE API クライアント ----

async function getClient(): Promise<messagingApi.MessagingApiClient> {
  return new messagingApi.MessagingApiClient({ channelAccessToken: await getToken() });
}

// Reply API でメッセージを返信する
export async function replyMessage(replyToken: string, text: string): Promise<void> {
  const client = await getClient();
  await client.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}

// Push API でメッセージをプッシュ送信する
export async function pushMessage(lineUserId: string, text: string): Promise<void> {
  const client = await getClient();
  await client.pushMessage({
    to: lineUserId,
    messages: [{ type: "text", text }],
  });
}
