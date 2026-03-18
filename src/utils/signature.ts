import { env } from "../config/env.js"

// Bun組み込みのCrypto API（crypto.subtle）でLINE署名を検証する
export async function verifyLineSignature(
  body: string,
  signature: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(env.LINE_CHANNEL_SECRET)
    const bodyData = encoder.encode(body)

    // HMAC-SHA256キーをインポート
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    // 署名を計算
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, bodyData)

    // Base64エンコードして比較
    const expectedSignature = btoa(
      String.fromCharCode(...new Uint8Array(signatureBuffer))
    )

    return expectedSignature === signature
  } catch {
    return false
  }
}
