import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { LinearIssue } from "@/domain/types";
import { handleCompleteSelect, handleCompleteTask } from "@/usecase/completeTask";
import { USER_NOT_FOUND_MESSAGE } from "@/utils/messages";

const mockReplyMessage = mock();
const mockGetUserByLineId = mock();
const mockGetIssueByIdentifier = mock();
const mockSearchIssues = mock();
const mockCompleteIssue = mock();

const deps = {
  line: { replyMessage: mockReplyMessage },
  linear: {
    getIssueByIdentifier: mockGetIssueByIdentifier,
    searchIssues: mockSearchIssues,
    completeIssue: mockCompleteIssue,
  },
  users: { getUserByLineId: mockGetUserByLineId },
};

const MOCK_USER = {
  lineUserId: "U123",
  linearUserId: "lin-uuid-1",
  displayName: "テスト",
  aliases: [],
};

const MOCK_ISSUES: LinearIssue[] = [
  {
    id: "i1",
    identifier: "ENG-1",
    title: "タスク1",
    url: "https://linear.app/t/ENG-1",
    state: { name: "Todo", type: "unstarted" },
    dueDate: null,
    priority: 0,
    assignee: null,
  },
  {
    id: "i2",
    identifier: "ENG-2",
    title: "タスク2",
    url: "https://linear.app/t/ENG-2",
    state: { name: "Todo", type: "unstarted" },
    dueDate: null,
    priority: 0,
    assignee: null,
  },
];

beforeEach(() => {
  mockReplyMessage.mockReset();
  mockGetUserByLineId.mockReset();
  mockGetIssueByIdentifier.mockReset();
  mockSearchIssues.mockReset();
  mockCompleteIssue.mockReset();
});

describe("handleCompleteTask", () => {
  it("未登録ユーザーには USER_NOT_FOUND_MESSAGE を返す", async () => {
    mockGetUserByLineId.mockReturnValue(undefined);
    await handleCompleteTask(deps, { type: "complete", query: "ENG-1" }, "U-unknown", "token");
    expect(mockReplyMessage).toHaveBeenCalledWith("token", USER_NOT_FOUND_MESSAGE);
  });

  it("識別子（ENG-1形式）で直接完了する", async () => {
    mockGetUserByLineId.mockReturnValue(MOCK_USER);
    mockGetIssueByIdentifier.mockResolvedValue(MOCK_ISSUES[0]);
    mockCompleteIssue.mockResolvedValue(MOCK_ISSUES[0]);

    await handleCompleteTask(deps, { type: "complete", query: "ENG-1" }, "U123", "token");

    expect(mockGetIssueByIdentifier).toHaveBeenCalledWith("ENG-1");
    expect(mockCompleteIssue).toHaveBeenCalledWith("i1");
    expect(mockReplyMessage).toHaveBeenCalledWith("token", expect.stringContaining("完了しました"));
  });

  it("識別子が見つからない場合はエラーメッセージを返す", async () => {
    mockGetUserByLineId.mockReturnValue(MOCK_USER);
    mockGetIssueByIdentifier.mockResolvedValue(null);

    await handleCompleteTask(deps, { type: "complete", query: "ENG-999" }, "U123", "token");

    expect(mockReplyMessage).toHaveBeenCalledWith(
      "token",
      expect.stringContaining("見つかりませんでした")
    );
  });

  it("キーワード検索で複数候補が出た場合は候補リストを返す", async () => {
    mockGetUserByLineId.mockReturnValue(MOCK_USER);
    mockSearchIssues.mockResolvedValue(MOCK_ISSUES);

    await handleCompleteTask(deps, { type: "complete", query: "タスク" }, "U123", "token");

    expect(mockReplyMessage).toHaveBeenCalledWith("token", expect.stringContaining("ENG-1"));
    expect(mockReplyMessage).toHaveBeenCalledWith("token", expect.stringContaining("ENG-2"));
  });

  it("キーワード検索で0件の場合はエラーメッセージを返す", async () => {
    mockGetUserByLineId.mockReturnValue(MOCK_USER);
    mockSearchIssues.mockResolvedValue([]);

    await handleCompleteTask(deps, { type: "complete", query: "存在しない" }, "U123", "token");

    expect(mockReplyMessage).toHaveBeenCalledWith(
      "token",
      expect.stringContaining("見つかりませんでした")
    );
  });
});

describe("handleCompleteSelect", () => {
  it("候補が未設定の場合はエラーメッセージを返す", async () => {
    await handleCompleteSelect(
      deps,
      { type: "complete_select", index: 1 },
      "U-no-candidates",
      "token"
    );
    expect(mockReplyMessage).toHaveBeenCalledWith(
      "token",
      expect.stringContaining("選択対象のタスクがありません")
    );
  });

  it("候補設定後に正しい番号で完了できる", async () => {
    mockGetUserByLineId.mockReturnValue(MOCK_USER);
    mockSearchIssues.mockResolvedValue(MOCK_ISSUES);
    mockCompleteIssue.mockResolvedValue(MOCK_ISSUES[1]);

    await handleCompleteTask(deps, { type: "complete", query: "タスク" }, "U-select", "token1");
    await handleCompleteSelect(deps, { type: "complete_select", index: 2 }, "U-select", "token2");

    expect(mockCompleteIssue).toHaveBeenCalledWith("i2");
    expect(mockReplyMessage).toHaveBeenLastCalledWith(
      "token2",
      expect.stringContaining("完了しました")
    );
  });

  it("範囲外の番号はエラーメッセージを返す", async () => {
    mockGetUserByLineId.mockReturnValue(MOCK_USER);
    mockSearchIssues.mockResolvedValue(MOCK_ISSUES);

    await handleCompleteTask(deps, { type: "complete", query: "タスク" }, "U-range", "token1");
    await handleCompleteSelect(deps, { type: "complete_select", index: 99 }, "U-range", "token2");

    expect(mockReplyMessage).toHaveBeenLastCalledWith(
      "token2",
      expect.stringContaining("無効な番号")
    );
  });

  it("TTL（10分）経過後は候補が失効する", async () => {
    const now = 1705276800000; // 2024-01-15T00:00:00Z
    let currentTime = now;
    const dateSpy = spyOn(Date, "now").mockImplementation(() => currentTime);

    mockGetUserByLineId.mockReturnValue(MOCK_USER);
    mockSearchIssues.mockResolvedValue(MOCK_ISSUES);

    await handleCompleteTask(deps, { type: "complete", query: "タスク" }, "U-ttl", "token1");

    // TTL（10分）+ 1ms 経過させる
    currentTime = now + 10 * 60 * 1000 + 1;

    await handleCompleteSelect(deps, { type: "complete_select", index: 1 }, "U-ttl", "token2");
    expect(mockReplyMessage).toHaveBeenLastCalledWith(
      "token2",
      expect.stringContaining("選択対象のタスクがありません")
    );

    dateSpy.mockRestore();
  });
});
