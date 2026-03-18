// Copyright 2026 Fractalyze Inc. All rights reserved.

import { getRedis } from "./kv";
import {
  getHalfYearObjective,
  getMonthlyGoals,
  getWeeklyTasks,
} from "./goals";
import type {
  GoalStatus,
  HalfYearObjective,
  MonthlyGoal,
  WeeklyTask,
} from "../types";

// Re-export with merged GitHub data
export { getAllGoalWeekIds } from "./goals";

import { getAllHalfYearPeriods as getManualHalfYearPeriods } from "./goals";

/** Get all half-year periods from both manual and GitHub sources. */
export async function getAllHalfYearPeriods(): Promise<string[]> {
  const redis = getRedis();
  const [manual, ghData] = await Promise.all([
    getManualHalfYearPeriods(),
    redis.get<string>("ghproject:index:periods"),
  ]);
  const ghPeriods: string[] = ghData
    ? typeof ghData === "string" ? JSON.parse(ghData) : ghData
    : [];
  const all = [...new Set([...manual, ...ghPeriods])];
  all.sort().reverse();
  return all;
}

// --- GitHub status override ---

/** Get the user-overridden status for a GitHub project item. */
async function getGhStatusOverride(
  itemId: string
): Promise<GoalStatus | null> {
  const redis = getRedis();
  const status = await redis.get<string>(`ghstatus:${itemId}`);
  if (!status) return null;
  return status as GoalStatus;
}

/** Set the user-overridden status for a GitHub project item. */
export async function setGhStatusOverride(
  itemId: string,
  status: GoalStatus
): Promise<void> {
  const redis = getRedis();
  await redis.set(`ghstatus:${itemId}`, status);
}

// --- GitHub field override (startDate, estimatedDeadline, actualDeadline) ---

interface GhFieldOverride {
  startDate?: string;
  estimatedDeadline?: string;
  actualDeadline?: string;
}

/** Get the user-overridden fields for a GitHub project item. */
async function getGhFieldOverride(
  itemId: string
): Promise<GhFieldOverride | null> {
  const redis = getRedis();
  const data = await redis.get<string>(`ghoverride:${itemId}`);
  if (!data) return null;
  const fields: Record<string, unknown> = typeof data === "string" ? JSON.parse(data) : data;
  // Backfill old `deadline` → `estimatedDeadline`
  if ("deadline" in fields && !("estimatedDeadline" in fields)) {
    fields.estimatedDeadline = fields.deadline;
    delete fields.deadline;
  }
  return fields as GhFieldOverride;
}

/** Set field overrides (startDate, estimatedDeadline, actualDeadline) for a GitHub project item. */
export async function setGhFieldOverride(
  itemId: string,
  fields: GhFieldOverride
): Promise<void> {
  const redis = getRedis();
  const existing = await getGhFieldOverride(itemId);
  const merged = { ...existing, ...fields };
  await redis.set(`ghoverride:${itemId}`, JSON.stringify(merged));
}

// --- GitHub cached data helpers ---

async function getGhHalfYearObjective(
  period: string
): Promise<HalfYearObjective | null> {
  const redis = getRedis();
  const data = await redis.get<string>(`ghproject:half:${period}`);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

async function getGhMonthlyGoals(month: string): Promise<MonthlyGoal[]> {
  const redis = getRedis();
  const data = await redis.get<string>(`ghproject:month:${month}`);
  if (!data) return [];
  return typeof data === "string" ? JSON.parse(data) : data;
}

/** Backfill old `deadline` → `estimatedDeadline` for tasks not yet migrated. */
function migrateTaskFields(task: Record<string, unknown>): WeeklyTask {
  if ("deadline" in task && !("estimatedDeadline" in task)) {
    const { deadline, ...rest } = task;
    return { ...rest, estimatedDeadline: deadline } as unknown as WeeklyTask;
  }
  return task as unknown as WeeklyTask;
}

async function getGhWeeklyTasks(weekId: string): Promise<WeeklyTask[]> {
  const redis = getRedis();
  const data = await redis.get<string>(`ghproject:week:${weekId}`);
  if (!data) return [];
  const raw: Record<string, unknown>[] = typeof data === "string" ? JSON.parse(data) : data;
  return raw.map(migrateTaskFields);
}

// --- Apply status overrides ---

async function applyMonthlyOverrides(
  goals: MonthlyGoal[]
): Promise<MonthlyGoal[]> {
  return Promise.all(
    goals.map(async (g) => {
      if (g.source !== "github" || !g.githubItemId) return g;
      const override = await getGhStatusOverride(g.githubItemId);
      return override ? { ...g, status: override } : g;
    })
  );
}

async function applyWeeklyOverrides(
  tasks: WeeklyTask[]
): Promise<WeeklyTask[]> {
  return Promise.all(
    tasks.map(async (t) => {
      if (t.source !== "github" || !t.githubItemId) return t;
      const [statusOverride, fieldOverride] = await Promise.all([
        getGhStatusOverride(t.githubItemId),
        getGhFieldOverride(t.githubItemId),
      ]);
      let result = t;
      if (statusOverride) result = { ...result, status: statusOverride };
      if (fieldOverride?.startDate) result = { ...result, startDate: fieldOverride.startDate };
      if (fieldOverride?.estimatedDeadline) result = { ...result, estimatedDeadline: fieldOverride.estimatedDeadline };
      if (fieldOverride?.actualDeadline) result = { ...result, actualDeadline: fieldOverride.actualDeadline };
      return result;
    })
  );
}

// --- Merged getters ---

/** Get half-year objective: prefer GitHub if exists, else manual. */
export async function getMergedHalfYearObjective(
  period: string
): Promise<HalfYearObjective | null> {
  const [manual, github] = await Promise.all([
    getHalfYearObjective(period),
    getGhHalfYearObjective(period),
  ]);
  // GitHub objective takes precedence (it's the strategic roadmap)
  return github ?? manual;
}

/** Get monthly goals from both sources merged, with status overrides. */
export async function getMergedMonthlyGoals(
  month: string
): Promise<MonthlyGoal[]> {
  const [manual, github] = await Promise.all([
    getMonthlyGoals(month),
    getGhMonthlyGoals(month),
  ]);
  const ghWithOverrides = await applyMonthlyOverrides(github);

  // Tag manual goals
  const taggedManual = manual.map((g) => ({
    ...g,
    source: g.source ?? ("manual" as const),
  }));

  return [...ghWithOverrides, ...taggedManual];
}

/** Get weekly tasks from both sources merged, with status overrides. */
export async function getMergedWeeklyTasks(
  weekId: string
): Promise<WeeklyTask[]> {
  const [manual, github] = await Promise.all([
    getWeeklyTasks(weekId),
    getGhWeeklyTasks(weekId),
  ]);
  const ghWithOverrides = await applyWeeklyOverrides(github);

  const taggedManual = manual.map((t) => ({
    ...t,
    source: t.source ?? ("manual" as const),
  }));

  return [...ghWithOverrides, ...taggedManual];
}
