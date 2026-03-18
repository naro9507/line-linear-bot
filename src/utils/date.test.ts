import { afterEach, describe, expect, it, jest } from "bun:test";
import { getJSTDateString, parseJSTDate } from "@/utils/date";

// 2024-01-15T00:00:00Z = 1705276800000
const JAN_15_UTC = 1705276800000;
// 2024-01-14T15:59:59Z（JST では 2024-01-15T00:59:59）
const JAN_14_UTC_LATE = new Date("2024-01-14T15:59:59Z").getTime();
// 2024-01-31T00:00:00Z
const JAN_31_UTC = new Date("2024-01-31T00:00:00Z").getTime();

let spy: ReturnType<typeof jest.spyOn>;

afterEach(() => {
  spy?.mockRestore();
});

describe("getJSTDateString", () => {
  it("UTC midnight → JST 09:00 として当日を返す", () => {
    spy = jest.spyOn(Date, "now").mockReturnValue(JAN_15_UTC);
    expect(getJSTDateString()).toBe("2024-01-15");
  });

  it("UTC 15:59 → JST 翌日 00:59 として翌日を返す", () => {
    spy = jest.spyOn(Date, "now").mockReturnValue(JAN_14_UTC_LATE);
    expect(getJSTDateString()).toBe("2024-01-15");
  });

  it("offsetDays=1 で翌日を返す", () => {
    spy = jest.spyOn(Date, "now").mockReturnValue(JAN_15_UTC);
    expect(getJSTDateString(1)).toBe("2024-01-16");
  });

  it("offsetDays=-1 で前日を返す", () => {
    spy = jest.spyOn(Date, "now").mockReturnValue(JAN_15_UTC);
    expect(getJSTDateString(-1)).toBe("2024-01-14");
  });

  it("月末をまたぐ offset を正しく処理する", () => {
    spy = jest.spyOn(Date, "now").mockReturnValue(JAN_31_UTC);
    expect(getJSTDateString(1)).toBe("2024-02-01");
  });
});

describe("parseJSTDate", () => {
  it("YYYY-MM-DD を JST 深夜0時の Date に変換する", () => {
    // 2024-01-15T00:00:00+09:00 = 2024-01-14T15:00:00Z
    expect(parseJSTDate("2024-01-15").toISOString()).toBe("2024-01-14T15:00:00.000Z");
  });

  it("Date インスタンスを返す", () => {
    expect(parseJSTDate("2024-06-01")).toBeInstanceOf(Date);
  });

  it("月末を正しく変換する", () => {
    expect(parseJSTDate("2024-01-31").toISOString()).toBe("2024-01-30T15:00:00.000Z");
  });
});
