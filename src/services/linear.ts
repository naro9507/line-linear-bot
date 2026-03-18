import { LinearClient } from "@linear/sdk"
import { env } from "../config/env.js"
import type { LinearIssue } from "../types/index.js"

// Linear APIクライアントの初期化
const linearClient = new LinearClient({ apiKey: env.LINEAR_API_KEY })

// タスク追加
export async function createIssue(params: {
  title: string
  dueDate?: string | null
  assigneeId?: string | null
  priority?: number | null
}): Promise<LinearIssue> {
  const result = await linearClient.client.rawRequest<{
    issueCreate: {
      success: boolean
      issue: {
        id: string
        identifier: string
        title: string
        url: string
        state: { name: string; type: string }
        dueDate: string | null
        priority: number
        assignee?: { id: string; name: string }
      }
    }
  }>(
    `mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier title url state { name type } dueDate priority assignee { id name } }
      }
    }`,
    {
      input: {
        teamId: env.LINEAR_TEAM_ID,
        title: params.title,
        ...(params.dueDate ? { dueDate: params.dueDate } : {}),
        ...(params.assigneeId ? { assigneeId: params.assigneeId } : {}),
        ...(params.priority != null ? { priority: params.priority } : {}),
      },
    }
  )

  const issue = result.issueCreate.issue
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    state: issue.state,
    dueDate: issue.dueDate,
    priority: issue.priority,
    assignee: issue.assignee,
  }
}

// 担当者のタスク一覧を取得（完了・キャンセル以外）
export async function listMyIssues(linearUserId: string): Promise<LinearIssue[]> {
  const result = await linearClient.client.rawRequest<{
    issues: {
      nodes: Array<{
        id: string
        identifier: string
        title: string
        url: string
        state: { name: string; type: string }
        dueDate: string | null
        priority: number
        assignee?: { id: string; name: string }
      }>
    }
  }>(
    `query MyIssues($filter: IssueFilter) {
      issues(filter: $filter) {
        nodes {
          id identifier title url
          state { name type }
          dueDate priority
          assignee { id name }
        }
      }
    }`,
    {
      filter: {
        assignee: { id: { eq: linearUserId } },
        state: { type: { nin: ["completed", "cancelled"] } },
      },
    }
  )

  return result.issues.nodes.map((n) => ({
    id: n.id,
    identifier: n.identifier,
    title: n.title,
    url: n.url,
    state: n.state,
    dueDate: n.dueDate,
    priority: n.priority,
    assignee: n.assignee,
  }))
}

// キーワードでタスクを検索する
export async function searchIssues(query: string): Promise<LinearIssue[]> {
  const result = await linearClient.client.rawRequest<{
    issues: {
      nodes: Array<{
        id: string
        identifier: string
        title: string
        url: string
        state: { name: string; type: string }
        dueDate: string | null
        priority: number
        assignee?: { id: string; name: string }
      }>
    }
  }>(
    `query SearchIssues($filter: IssueFilter) {
      issues(filter: $filter) {
        nodes {
          id identifier title url
          state { name type }
          dueDate priority
          assignee { id name }
        }
      }
    }`,
    {
      filter: {
        title: { containsIgnoreCase: query },
        state: { type: { nin: ["completed", "cancelled"] } },
      },
    }
  )

  return result.issues.nodes.map((n) => ({
    id: n.id,
    identifier: n.identifier,
    title: n.title,
    url: n.url,
    state: n.state,
    dueDate: n.dueDate,
    priority: n.priority,
    assignee: n.assignee,
  }))
}

// 識別子（ENG-42 など）でタスクを取得する
export async function getIssueByIdentifier(identifier: string): Promise<LinearIssue | null> {
  const result = await linearClient.client.rawRequest<{
    issues: {
      nodes: Array<{
        id: string
        identifier: string
        title: string
        url: string
        state: { name: string; type: string }
        dueDate: string | null
        priority: number
        assignee?: { id: string; name: string }
      }>
    }
  }>(
    `query GetIssueByIdentifier($filter: IssueFilter) {
      issues(filter: $filter) {
        nodes {
          id identifier title url
          state { name type }
          dueDate priority
          assignee { id name }
        }
      }
    }`,
    {
      filter: {
        identifier: { eq: identifier.toUpperCase() },
      },
    }
  )

  const node = result.issues.nodes[0]
  if (!node) return null

  return {
    id: node.id,
    identifier: node.identifier,
    title: node.title,
    url: node.url,
    state: node.state,
    dueDate: node.dueDate,
    priority: node.priority,
    assignee: node.assignee,
  }
}

// タスクを完了状態に更新する
export async function completeIssue(id: string): Promise<LinearIssue> {
  // まず Done ステートのIDを取得する
  const teamResult = await linearClient.client.rawRequest<{
    team: {
      states: {
        nodes: Array<{ id: string; name: string; type: string }>
      }
    }
  }>(
    `query GetTeamStates($teamId: String!) {
      team(id: $teamId) {
        states { nodes { id name type } }
      }
    }`,
    { teamId: env.LINEAR_TEAM_ID }
  )

  const doneState = teamResult.team.states.nodes.find((s) => s.type === "completed")
  if (!doneState) {
    throw new Error("Doneステートが見つかりません")
  }

  const result = await linearClient.client.rawRequest<{
    issueUpdate: {
      success: boolean
      issue: {
        id: string
        identifier: string
        title: string
        url: string
        state: { name: string; type: string }
        dueDate: string | null
        priority: number
        assignee?: { id: string; name: string }
      }
    }
  }>(
    `mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue { id identifier title url state { name type } dueDate priority assignee { id name } }
      }
    }`,
    {
      id,
      input: { stateId: doneState.id },
    }
  )

  const issue = result.issueUpdate.issue
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    state: issue.state,
    dueDate: issue.dueDate,
    priority: issue.priority,
    assignee: issue.assignee,
  }
}

// リマインド対象のイシューを取得する（期限が今日または明日）
export async function getRemindIssues(): Promise<LinearIssue[]> {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const todayStr = today.toISOString().split("T")[0]
  const tomorrowStr = tomorrow.toISOString().split("T")[0]

  const result = await linearClient.client.rawRequest<{
    issues: {
      nodes: Array<{
        id: string
        identifier: string
        title: string
        url: string
        state: { name: string; type: string }
        dueDate: string | null
        priority: number
        assignee?: { id: string; name: string }
      }>
    }
  }>(
    `query RemindIssues($filter: IssueFilter) {
      issues(filter: $filter) {
        nodes {
          id identifier title url
          state { name type }
          dueDate priority
          assignee { id name }
        }
      }
    }`,
    {
      filter: {
        state: { type: { in: ["started", "unstarted"] } },
        dueDate: { in: [todayStr, tomorrowStr] },
      },
    }
  )

  return result.issues.nodes.map((n) => ({
    id: n.id,
    identifier: n.identifier,
    title: n.title,
    url: n.url,
    state: n.state,
    dueDate: n.dueDate,
    priority: n.priority,
    assignee: n.assignee,
  }))
}
