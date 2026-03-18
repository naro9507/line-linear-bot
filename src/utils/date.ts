const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** JST での日付文字列（YYYY-MM-DD）を返す。offsetDays で日数をずらせる */
export function getJSTDateString(offsetDays = 0): string {
  const d = new Date(Date.now() + JST_OFFSET_MS);
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
  // biome-ignore lint/style/noNonNullAssertion: ISO文字列は必ず "T" を含む
  return d.toISOString().split("T")[0]!;
}

/** YYYY-MM-DD 文字列を JST の Date オブジェクトに変換する */
export function parseJSTDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+09:00`);
}
