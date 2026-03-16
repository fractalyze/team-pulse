// Copyright 2026 Fractalyze Inc. All rights reserved.

import { graphql } from "@octokit/graphql";
import { getRedis } from "../store/kv";
import { GITHUB_PROJECT_ID } from "../config";
import type {
  GoalStatus,
  HalfYearObjective,
  MonthlyGoal,
  WeeklyTask,
} from "../types";

// --- Types for GraphQL response ---

interface ProjectFieldValue {
  field: { name: string };
  text?: string;
  name?: string; // for single-select fields
  title?: string; // for iteration fields
}

interface ProjectItem {
  id: string;
  content: {
    __typename: string;
    title?: string;
    url?: string;
    assignees?: { nodes: { login: string }[] };
  } | null;
  fieldValues: {
    nodes: ProjectFieldValue[];
  };
}

interface ProjectItemsResponse {
  node: {
    items: {
      pageInfo: { hasNextPage: boolean; endCursor: string };
      nodes: ProjectItem[];
    };
  };
}

// --- GraphQL ---

const ITEMS_QUERY = `
  query($projectId: ID!, $cursor: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: 100, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            content {
              __typename
              ... on Issue {
                title
                url
                assignees(first: 10) { nodes { login } }
              }
              ... on PullRequest {
                title
                url
                assignees(first: 10) { nodes { login } }
              }
              ... on DraftIssue {
                title
              }
            }
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldTextValue {
                  field { ... on ProjectV2Field { name } }
                  text
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  field { ... on ProjectV2SingleSelectField { name } }
                  name
                }
                ... on ProjectV2ItemFieldIterationValue {
                  field { ... on ProjectV2IterationField { name } }
                  title
                }
              }
            }
          }
        }
      }
    }
  }
`;

function getGraphqlClient() {
  return graphql.defaults({
    headers: { authorization: `token ${process.env.GITHUB_TOKEN}` },
  });
}

/** Fetch all project items with pagination. */
async function fetchProjectItems(): Promise<ProjectItem[]> {
  const gql = getGraphqlClient();
  const items: ProjectItem[] = [];
  let cursor: string | null = null;

  let hasNextPage = true;
  while (hasNextPage) {
    const response: ProjectItemsResponse = await gql(ITEMS_QUERY, {
      projectId: GITHUB_PROJECT_ID,
      cursor,
    });

    items.push(...response.node.items.nodes);

    if (response.node.items.pageInfo.hasNextPage) {
      cursor = response.node.items.pageInfo.endCursor;
    } else {
      hasNextPage = false;
    }
  }

  return items;
}

// --- Field helpers ---

function getField(item: ProjectItem, fieldName: string): string | undefined {
  for (const fv of item.fieldValues.nodes) {
    if (fv.field?.name === fieldName) {
      return fv.text ?? fv.name ?? fv.title;
    }
  }
  return undefined;
}

function getTitle(item: ProjectItem): string {
  return item.content?.title ?? "(untitled)";
}

function getUrl(item: ProjectItem): string | undefined {
  if (item.content && "url" in item.content) {
    return item.content.url as string;
  }
  return undefined;
}

function getAssignees(item: ProjectItem): string[] {
  if (item.content && "assignees" in item.content && item.content.assignees) {
    return item.content.assignees.nodes.map((a) => a.login);
  }
  return [];
}

/** Map GitHub Project status to GoalStatus. */
function mapGitHubStatus(ghStatus: string | undefined): GoalStatus {
  if (!ghStatus) return "not_started";
  const lower = ghStatus.toLowerCase();
  if (lower === "done" || lower === "merged" || lower === "closed")
    return "done";
  if (
    lower === "in progress" ||
    lower === "in_progress" ||
    lower === "in review"
  )
    return "in_progress";
  return "not_started";
}

// --- Mapping to goal types ---

interface MappedGoals {
  objectives: HalfYearObjective[];
  monthlyGoals: MonthlyGoal[];
  weeklyTasks: WeeklyTask[];
}

function mapToGoals(items: ProjectItem[]): MappedGoals {
  const objectives: HalfYearObjective[] = [];
  const monthlyGoals: MonthlyGoal[] = [];
  const weeklyTasks: WeeklyTask[] = [];
  const now = new Date().toISOString();

  // First pass: collect Monthly Goals to build title → id map for goalId linking
  const monthlyGoalIdByTitle = new Map<string, string>();

  for (const item of items) {
    const level = getField(item, "Level");
    if (level !== "Monthly Goal") continue;

    const month = getField(item, "Month");
    if (!month) continue;

    const title = getTitle(item);
    const ghStatus = getField(item, "Status");
    const url = getUrl(item);
    const id = `gh-${item.id}`;

    monthlyGoalIdByTitle.set(title, id);

    monthlyGoals.push({
      id,
      month,
      title,
      status: mapGitHubStatus(ghStatus),
      source: "github",
      githubUrl: url,
      githubItemId: item.id,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Second pass: Objectives and Weekly Goals
  for (const item of items) {
    const level = getField(item, "Level");
    if (!level) continue;

    const ghStatus = getField(item, "Status");
    const title = getTitle(item);
    const url = getUrl(item);

    if (level === "Objective") {
      const objective = getField(item, "Objective");
      // Parse period from Objective field (e.g., "2026-H1")
      const period = objective ?? "unknown";

      objectives.push({
        id: `gh-${item.id}`,
        period,
        title,
        description: undefined,
        source: "github",
        githubUrl: url,
        githubItemId: item.id,
        createdAt: now,
        updatedAt: now,
      });
    } else if (level === "Weekly Goal") {
      const sprint = getField(item, "Sprint"); // e.g., "W12"
      if (!sprint) continue;

      // Derive year from Objective field or default to current year
      const objective = getField(item, "Objective");
      const year = objective
        ? parseInt(objective.split("-")[0], 10)
        : new Date().getFullYear();
      const weekId = `${year}-${sprint}`;

      const assignees = getAssignees(item);
      const assignee = assignees[0] ?? "unassigned";

      // Link to parent Monthly Goal via "Monthly Goal" field
      const monthlyGoalTitle = getField(item, "Monthly Goal");
      const goalId = monthlyGoalTitle
        ? monthlyGoalIdByTitle.get(monthlyGoalTitle)
        : undefined;

      weeklyTasks.push({
        id: `gh-${item.id}`,
        weekId,
        assignee,
        content: title,
        deadline: "",
        status: mapGitHubStatus(ghStatus),
        goalId,
        source: "github",
        githubUrl: url,
        githubItemId: item.id,
        createdAt: now,
        updatedAt: now,
      });
    }
    // "Monthly Goal" handled in first pass; "Weekly Task" (PRs) skipped
  }

  return { objectives, monthlyGoals, weeklyTasks };
}

// --- Redis sync ---

export interface SyncResult {
  objectives: number;
  monthlyGoals: number;
  weeklyTasks: number;
  lastSynced: string;
}

/** Fetch GitHub Project items and cache them in Redis. */
export async function syncGitHubProjectToRedis(): Promise<SyncResult> {
  const items = await fetchProjectItems();
  const { objectives, monthlyGoals, weeklyTasks } = mapToGoals(items);
  const redis = getRedis();

  // Clear old ghproject keys
  const oldKeys = await redis.keys("ghproject:*");
  if (oldKeys.length > 0) {
    await redis.del(...oldKeys);
  }

  // Store objectives by period
  for (const obj of objectives) {
    await redis.set(`ghproject:half:${obj.period}`, JSON.stringify(obj));
  }

  // Store monthly goals grouped by month
  const goalsByMonth = new Map<string, MonthlyGoal[]>();
  for (const goal of monthlyGoals) {
    if (!goalsByMonth.has(goal.month)) goalsByMonth.set(goal.month, []);
    goalsByMonth.get(goal.month)!.push(goal);
  }
  for (const [month, goals] of goalsByMonth) {
    await redis.set(`ghproject:month:${month}`, JSON.stringify(goals));
  }

  // Store weekly tasks grouped by weekId
  const tasksByWeek = new Map<string, WeeklyTask[]>();
  for (const task of weeklyTasks) {
    if (!tasksByWeek.has(task.weekId)) tasksByWeek.set(task.weekId, []);
    tasksByWeek.get(task.weekId)!.push(task);
  }
  for (const [weekId, tasks] of tasksByWeek) {
    await redis.set(`ghproject:week:${weekId}`, JSON.stringify(tasks));
  }

  // Store index keys for enumeration
  const months = [...goalsByMonth.keys()].sort();
  const weeks = [...tasksByWeek.keys()].sort();
  const periods = objectives.map((o) => o.period);
  await redis.set("ghproject:index:months", JSON.stringify(months));
  await redis.set("ghproject:index:weeks", JSON.stringify(weeks));
  await redis.set("ghproject:index:periods", JSON.stringify(periods));

  const lastSynced = new Date().toISOString();
  await redis.set("ghproject:last_synced", lastSynced);

  return {
    objectives: objectives.length,
    monthlyGoals: monthlyGoals.length,
    weeklyTasks: weeklyTasks.length,
    lastSynced,
  };
}
