// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Octokit } from "@octokit/rest";
import { ORG, PROJECT_NUMBER } from "../config";
import type { ProjectItem, ProjectMetrics, GoalProgressSummary } from "../types";

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return new Octokit({ auth: token });
}

const PROJECT_ITEMS_QUERY = `
query($org: String!, $number: Int!, $cursor: String) {
  organization(login: $org) {
    projectV2(number: $number) {
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                field { ... on ProjectV2IterationField { name } }
              }
              ... on ProjectV2ItemFieldTextValue {
                text
                field { ... on ProjectV2Field { name } }
              }
            }
          }
          content {
            ... on Issue {
              __typename
              title
              url
              number
              author { login }
              assignees(first: 10) { nodes { login } }
              repository { name }
              state
            }
            ... on PullRequest {
              __typename
              title
              url
              number
              author { login }
              assignees(first: 10) { nodes { login } }
              repository { name }
              state
              merged
              mergedAt
              isDraft
            }
            ... on DraftIssue {
              __typename
              title
              assignees(first: 10) { nodes { login } }
            }
          }
        }
      }
    }
  }
}
`;

// --- GraphQL types ---

interface GraphQLFieldValue {
  name?: string;
  title?: string;
  text?: string;
  field?: { name?: string };
}

interface GraphQLContent {
  __typename: string;
  title?: string;
  url?: string;
  number?: number;
  author?: { login: string };
  assignees?: { nodes: { login: string }[] };
  repository?: { name: string };
  state?: string;
  merged?: boolean;
  mergedAt?: string;
  isDraft?: boolean;
}

interface GraphQLNode {
  id: string;
  fieldValues: { nodes: GraphQLFieldValue[] };
  content: GraphQLContent | null;
}

interface GraphQLResponse {
  organization: {
    projectV2: {
      items: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: GraphQLNode[];
      };
    };
  };
}

function extractFieldValue(
  fieldValues: GraphQLFieldValue[],
  fieldName: string
): string | null {
  for (const fv of fieldValues) {
    if (fv.field?.name === fieldName) {
      return fv.name ?? fv.title ?? fv.text ?? null;
    }
  }
  return null;
}

function parseProjectItem(node: GraphQLNode): ProjectItem | null {
  const content = node.content;
  if (!content) return null;

  const fields = node.fieldValues.nodes;
  const typename = content.__typename;

  let type: ProjectItem["type"];
  if (typename === "PullRequest") type = "PULL_REQUEST";
  else if (typename === "Issue") type = "ISSUE";
  else if (typename === "DraftIssue") type = "DRAFT_ISSUE";
  else return null;

  return {
    id: node.id,
    type,
    title: content.title ?? "",
    url: content.url ?? null,
    repo: content.repository?.name ?? null,
    number: content.number ?? null,
    author: content.author?.login ?? null,
    assignees: content.assignees?.nodes.map((a) => a.login) ?? [],
    sprint: extractFieldValue(fields, "Sprint"),
    monthlyGoal: extractFieldValue(fields, "Monthly Goal"),
    status: extractFieldValue(fields, "Status"),
    level: extractFieldValue(fields, "Level"),
    merged: content.merged ?? false,
    mergedAt: content.mergedAt ?? null,
  };
}

/** Fetch all project items from GitHub Projects. */
async function fetchAllProjectItems(
  octokit: Octokit
): Promise<ProjectItem[]> {
  const items: ProjectItem[] = [];
  let cursor: string | null = null;

  while (true) {
    const result: GraphQLResponse = await octokit.graphql(
      PROJECT_ITEMS_QUERY,
      { org: ORG, number: PROJECT_NUMBER, cursor }
    );

    const page = result.organization.projectV2.items;
    for (const node of page.nodes) {
      const item = parseProjectItem(node);
      if (item) items.push(item);
    }

    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }

  return items;
}

/** Extract sprint week number from weekId (e.g., "2026-W12" → "W12"). */
function weekIdToSprint(weekId: string): string {
  const match = weekId.match(/W(\d+)/);
  return match ? `W${match[1]}` : weekId;
}

/** Build goal progress summaries from items grouped by goal. */
function buildGoalProgress(
  byGoal: Record<string, ProjectItem[]>
): GoalProgressSummary[] {
  return Object.entries(byGoal).map(([goalName, items]) => {
    const mergedCount = items.filter((i) => i.merged).length;
    const inReviewCount = items.filter(
      (i) => i.status === "In Review"
    ).length;
    const draftCount = items.filter((i) => i.status === "Draft").length;
    const closedCount = items.filter(
      (i) => i.status === "Closed" && !i.merged
    ).length;
    const totalItems = items.length;
    const assignees = [...new Set(items.flatMap((i) => i.assignees))];
    const progressPercent =
      totalItems > 0 ? Math.round((mergedCount / totalItems) * 100) : 0;

    return {
      goalName,
      totalItems,
      mergedCount,
      inReviewCount,
      draftCount,
      closedCount,
      assignees,
      progressPercent,
    };
  });
}

/** Collect project metrics for a given week. */
export async function collectProjectMetrics(
  weekId: string
): Promise<ProjectMetrics> {
  const octokit = getOctokit();
  const allItems = await fetchAllProjectItems(octokit);
  const sprint = weekIdToSprint(weekId);

  // Filter items for this sprint
  const items = allItems.filter((item) => {
    if (!item.sprint) return false;
    // Sprint field may contain "W12" or just the number
    const itemSprint = item.sprint.replace(/^W0?/, "W");
    const targetSprint = sprint.replace(/^W0?/, "W");
    return itemSprint === targetSprint;
  });

  // Group by goal
  const byGoal: Record<string, ProjectItem[]> = {};
  for (const item of items) {
    const goal = item.monthlyGoal ?? "Ungrouped";
    if (!byGoal[goal]) byGoal[goal] = [];
    byGoal[goal].push(item);
  }

  // Group by assignee
  const byAssignee: Record<string, ProjectItem[]> = {};
  for (const item of items) {
    const assignees = item.assignees.length > 0 ? item.assignees : [item.author ?? "unassigned"];
    for (const assignee of assignees) {
      if (!byAssignee[assignee]) byAssignee[assignee] = [];
      byAssignee[assignee].push(item);
    }
  }

  // Count by status
  const byStatus: Record<string, number> = {};
  for (const item of items) {
    const status = item.status ?? "Unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }

  const goalProgress = buildGoalProgress(byGoal);

  return {
    weekId,
    sprint,
    items,
    byGoal,
    byAssignee,
    byStatus,
    goalProgress,
  };
}
