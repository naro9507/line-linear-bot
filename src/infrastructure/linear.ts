import { env } from "@/config/env";
import type { LinearRepository, TeamState } from "@/domain/repositories";
import type { LinearIssue } from "@/domain/types";
import { getJSTDateString } from "@/utils/date";
import { LinearClient } from "@linear/sdk";

// エディタのGraphQLシンタックスハイライト対応のタグ関数（実態はそのままの文字列）
const gql = (strings: TemplateStringsArray): string => strings.raw[0] ?? "";

// 全クエリで共通のイシューフィールド選択
const ISSUE_FIELDS =
  "id identifier title url state { name type } dueDate priority assignee { id name }";

// Linear APIクライアントの初期化
const linearClient = new LinearClient({ apiKey: env.LINEAR_API_KEY });

// タスク追加
export async function createIssue(params: {
  title: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  priority?: number | null;
  description?: string | null;
}): Promise<LinearIssue> {
  const result = await linearClient.client.rawRequest<{
    issueCreate: { success: boolean; issue: IssueNode };
  }>(
    gql`
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { ${ISSUE_FIELDS} }
        }
      }
    `,
    {
      input: {
        teamId: env.LINEAR_TEAM_ID,
        title: params.title,
        ...(params.dueDate ? { dueDate: params.dueDate } : {}),
        ...(params.assigneeId ? { assigneeId: params.assigneeId } : {}),
        ...(params.priority != null ? { priority: params.priority } : {}),
        ...(params.description ? { description: params.description } : {}),
      },
    }
  );

  return toLinearIssue(result.issueCreate.issue);
}

// 担当者のタスク一覧を取得（完了・キャンセル以外）
export async function listMyIssues(linearUserId: string): Promise<LinearIssue[]> {
  const result = await linearClient.client.rawRequest<{ issues: { nodes: IssueNode[] } }>(
    gql`
      query MyIssues($filter: IssueFilter) {
        issues(filter: $filter) {
          nodes { ${ISSUE_FIELDS} }
        }
      }
    `,
    {
      filter: {
        assignee: { id: { eq: linearUserId } },
        state: { type: { nin: ["completed", "cancelled"] } },
      },
    }
  );

  return result.issues.nodes.map(toLinearIssue);
}

// キーワードでタスクを検索する
export async function searchIssues(query: string): Promise<LinearIssue[]> {
  const result = await linearClient.client.rawRequest<{ issues: { nodes: IssueNode[] } }>(
    gql`
      query SearchIssues($filter: IssueFilter) {
        issues(filter: $filter) {
          nodes { ${ISSUE_FIELDS} }
        }
      }
    `,
    {
      filter: {
        title: { containsIgnoreCase: query },
        state: { type: { nin: ["completed", "cancelled"] } },
      },
    }
  );

  return result.issues.nodes.map(toLinearIssue);
}

// 識別子（ENG-42 など）でタスクを取得する
export async function getIssueByIdentifier(identifier: string): Promise<LinearIssue | null> {
  const result = await linearClient.client.rawRequest<{ issues: { nodes: IssueNode[] } }>(
    gql`
      query GetIssueByIdentifier($filter: IssueFilter) {
        issues(filter: $filter) {
          nodes { ${ISSUE_FIELDS} }
        }
      }
    `,
    { filter: { identifier: { eq: identifier.toUpperCase() } } }
  );

  const node = result.issues.nodes[0];
  return node ? toLinearIssue(node) : null;
}

// タスクを完了状態に更新する
export async function completeIssue(id: string): Promise<LinearIssue> {
  const teamResult = await linearClient.client.rawRequest<{
    team: { states: { nodes: Array<{ id: string; name: string; type: string }> } };
  }>(
    gql`
      query GetTeamStates($teamId: String!) {
        team(id: $teamId) {
          states { nodes { id name type } }
        }
      }
    `,
    { teamId: env.LINEAR_TEAM_ID }
  );

  const doneState = teamResult.team.states.nodes.find((s) => s.type === "completed");
  if (!doneState) {
    const available = teamResult.team.states.nodes.map((s) => s.type).join(", ");
    throw new Error(`Doneステートが見つかりません。利用可能なステート: ${available}`);
  }

  const result = await linearClient.client.rawRequest<{
    issueUpdate: { success: boolean; issue: IssueNode };
  }>(
    gql`
      mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue { ${ISSUE_FIELDS} }
        }
      }
    `,
    { id, input: { stateId: doneState.id } }
  );

  return toLinearIssue(result.issueUpdate.issue);
}

// タスクを更新する
export async function updateIssue(
  id: string,
  params: {
    title?: string;
    dueDate?: string | null;
    assigneeId?: string | null;
    priority?: number | null;
    stateId?: string;
  }
): Promise<LinearIssue> {
  const input: Record<string, unknown> = {};
  if (params.title !== undefined) input.title = params.title;
  if (params.dueDate !== undefined) input.dueDate = params.dueDate;
  if (params.assigneeId !== undefined) input.assigneeId = params.assigneeId;
  if (params.priority !== undefined) input.priority = params.priority;
  if (params.stateId !== undefined) input.stateId = params.stateId;

  const result = await linearClient.client.rawRequest<{
    issueUpdate: { success: boolean; issue: IssueNode };
  }>(
    gql`
      mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue { ${ISSUE_FIELDS} }
        }
      }
    `,
    { id, input }
  );

  return toLinearIssue(result.issueUpdate.issue);
}

// チームのステータス一覧を取得する
export async function getTeamStates(): Promise<TeamState[]> {
  const result = await linearClient.client.rawRequest<{
    team: { states: { nodes: Array<{ id: string; name: string; type: string }> } };
  }>(
    gql`
      query GetTeamStates($teamId: String!) {
        team(id: $teamId) {
          states { nodes { id name type } }
        }
      }
    `,
    { teamId: env.LINEAR_TEAM_ID }
  );

  return result.team.states.nodes;
}

// リマインド対象のイシューを取得する（期限が今日または明日）
export async function getRemindIssues(): Promise<LinearIssue[]> {
  const todayStr = getJSTDateString();
  const tomorrowStr = getJSTDateString(1);

  const result = await linearClient.client.rawRequest<{ issues: { nodes: IssueNode[] } }>(
    gql`
      query RemindIssues($filter: IssueFilter) {
        issues(filter: $filter) {
          nodes { ${ISSUE_FIELDS} }
        }
      }
    `,
    {
      filter: {
        state: { type: { in: ["started", "unstarted"] } },
        dueDate: { in: [todayStr, tomorrowStr] },
      },
    }
  );

  return result.issues.nodes.map(toLinearIssue);
}

export const linearRepository = {
  createIssue,
  listMyIssues,
  searchIssues,
  getIssueByIdentifier,
  completeIssue,
  updateIssue,
  getTeamStates,
  getRemindIssues,
} satisfies LinearRepository;

// ---- 内部型・変換ヘルパー ----

interface IssueNode {
  id: string;
  identifier: string;
  title: string;
  url: string;
  state: { name: string; type: string };
  dueDate: string | null;
  priority: number;
  assignee?: { id: string; name: string };
}

function toLinearIssue(n: IssueNode): LinearIssue {
  return {
    id: n.id,
    identifier: n.identifier,
    title: n.title,
    url: n.url,
    state: n.state,
    dueDate: n.dueDate,
    priority: n.priority,
    assignee: n.assignee,
  };
}
