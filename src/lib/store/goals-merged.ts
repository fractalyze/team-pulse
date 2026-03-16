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

// Re-export unchanged functions
export { getAllHalfYearPeriods, getAllGoalWeekIds } from "./goals";

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

async function getGhWeeklyTasks(weekId: string): Promise<WeeklyTask[]> {
  const redis = getRedis();
  const data = await redis.get<string>(`ghproject:week:${weekId}`);
  if (!data) return [];
  return typeof data === "string" ? JSON.parse(data) : data;
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
      const override = await getGhStatusOverride(t.githubItemId);
      return override ? { ...t, status: override } : t;
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
