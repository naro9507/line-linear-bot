import { messagingApi } from "@line/bot-sdk"
import { env } from "../config/env.js"

// LINE Messaging API クライアントの初期化
const client = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
})

// Reply APIでメッセージを返信する
export async function replyMessage(replyToken: string, text: string): Promise<void> {
  await client.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text,
      },
    ],
  })
}

// Push APIでメッセージをプッシュ送信する
export async function pushMessage(lineUserId: string, text: string): Promise<void> {
  await client.pushMessage({
    to: lineUserId,
    messages: [
      {
        type: "text",
        text,
      },
    ],
  })
}
