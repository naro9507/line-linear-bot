import { describe, expect, it, mock } from "bun:test";

// mock.module はインポートより前に評価される必要があるため、動的 import を使う
mock.module("@/config/env", () => ({
  env: { LINE_CHANNEL_SECRET: "test-channel-secret" },
}));
mock.module("@/utils/logger", () => ({
  logger: { error: () => {}, info: () => {}, warn: () => {} },
}));

const { verifyLineSignature } = await import("@/infrastructure/signature");

/** テスト用 HMAC-SHA256 署名を生成する */
async function makeSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

const BODY = '{"destination":"Udeadbeef","events":[]}';

describe("verifyLineSignature", () => {
  it("正しい署名は true を返す", async () => {
    const sig = await makeSignature(BODY, "test-channel-secret");
    expect(await verifyLineSignature(BODY, sig)).toBe(true);
  });

  it("不正な署名文字列は false を返す", async () => {
    expect(await verifyLineSignature(BODY, "totally-wrong")).toBe(false);
  });

  it("別の鍵で署名された場合は false を返す", async () => {
    const sig = await makeSignature(BODY, "different-secret");
    expect(await verifyLineSignature(BODY, sig)).toBe(false);
  });

  it("ボディを改ざんした場合は false を返す", async () => {
    const sig = await makeSignature(BODY, "test-channel-secret");
    expect(await verifyLineSignature('{"tampered":true}', sig)).toBe(false);
  });
});
