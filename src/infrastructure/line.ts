import { env } from "@/config/env";
import type { LineRepository } from "@/domain/repositories";
import type { QuickReplyItem } from "@/domain/types";
import { messagingApi } from "@line/bot-sdk";

// LINE Messaging API クライアントの初期化
const client = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
});

// Reply APIでメッセージを返信する
export async function replyMessage(replyToken: string, text: string): Promise<void> {
  await client.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}

// Quick Reply ボタン付きでメッセージを返信する
export async function replyWithQuickReply(
  replyToken: string,
  text: string,
  items: QuickReplyItem[]
): Promise<void> {
  await client.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text,
        quickReply: {
          items: items.map((item) => ({
            type: "action" as const,
            action: {
              type: "postback" as const,
              label: item.label,
              data: item.postbackData,
              displayText: item.label,
            },
          })),
        },
      },
    ],
  });
}

// Push APIでメッセージをプッシュ送信する
export async function pushMessage(lineUserId: string, text: string): Promise<void> {
  await client.pushMessage({
    to: lineUserId,
    messages: [{ type: "text", text }],
  });
}

export const lineRepository = {
  replyMessage,
  replyWithQuickReply,
  pushMessage,
} satisfies LineRepository;
