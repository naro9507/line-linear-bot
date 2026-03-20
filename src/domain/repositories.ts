import type { Command, LinearIssue, UserMapping } from "@/domain/types";

export interface LineRepository {
  replyMessage(replyToken: string, text: string): Promise<void>;
  pushMessage(lineUserId: string, text: string): Promise<void>;
}

export interface LinearRepository {
  createIssue(params: {
    title: string;
    dueDate?: string | null;
    assigneeId?: string | null;
    priority?: number | null;
  }): Promise<LinearIssue>;
  listMyIssues(linearUserId: string): Promise<LinearIssue[]>;
  searchIssues(query: string): Promise<LinearIssue[]>;
  getIssueByIdentifier(identifier: string): Promise<LinearIssue | null>;
  completeIssue(id: string): Promise<LinearIssue>;
  getRemindIssues(): Promise<LinearIssue[]>;
}

export interface GeminiRepository {
  parseMessageWithGemini(message: string, today: string): Promise<Command>;
}

export interface UserRepository {
  getUserByLineId(lineUserId: string): UserMapping | undefined;
  getUserByLinearId(linearUserId: string): UserMapping | undefined;
  getUserByAlias(alias: string): UserMapping | undefined;
}
