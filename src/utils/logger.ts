import pino from "pino";

// Cloud Logging (Google Cloud) 互換の構造化ロガー
// severity フィールドで Cloud Logging の重要度フィルタと対応させる
export const logger = pino({
  level: "info",
  messageKey: "message",
  formatters: {
    level(label) {
      const map: Record<string, string> = {
        trace: "DEBUG",
        debug: "DEBUG",
        info: "INFO",
        warn: "WARNING",
        error: "ERROR",
        fatal: "CRITICAL",
      };
      return { severity: map[label] ?? "INFO" };
    },
  },
});
