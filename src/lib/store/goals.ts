// Copyright 2026 Fractalyze Inc. All rights reserved.

import { getRedis } from "./kv";
import { getWeekRange } from "../week";
import type { HalfYearObjective, MonthlyGoal, WeeklyTask } from "../types";

// --- Half-Year Objectives ---

export async function getHalfYearObjective(
  period: string
): Promise<HalfYearObjective | null> {
  const redis = getRedis();
  const data = await redis.get<string>(`goal:half:${period}`);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function saveHalfYearObjective(
  obj: HalfYearObjective
): Promise<void> {
  const redis = getRedis();
  await redis.set(`goal:half:${obj.period}`, JSON.stringify(obj));
  const [yearStr, halfStr] = obj.period.split("-");
  const score = parseInt(yearStr, 10) * 10 + (halfStr === "H1" ? 1 : 2);
  await redis.zadd("goal:halves", { score, member: obj.period });
}

export async function deleteHalfYearObjective(period: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`goal:half:${period}`);
  await redis.zrem("goal:halves", period);
}

export async function getAllHalfYearPeriods(): Promise<string[]> {
  const redis = getRedis();
  const periods = await redis.zrange("goal:halves", 0, -1, { rev: true });
  return periods as string[];
}

// --- Monthly Goals ---

export async function getMonthlyGoals(month: string): Promise<MonthlyGoal[]> {
  const redis = getRedis();
  const data = await redis.get<string>(`goal:month:${month}`);
  if (!data) return [];
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function saveMonthlyGoals(
  month: string,
  goals: MonthlyGoal[]
): Promise<void> {
  const redis = getRedis();
  await redis.set(`goal:month:${month}`, JSON.stringify(goals));
  const [yearStr, monthStr] = month.split("-");
  const score = parseInt(yearStr, 10) * 100 + parseInt(monthStr, 10);
  await redis.zadd("goal:months", { score, member: month });
}

export async function deleteMonthlyGoals(month: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`goal:month:${month}`);
  await redis.zrem("goal:months", month);
}

/** Get all goal week IDs in reverse chronological order. */
export async function getAllGoalWeekIds(): Promise<string[]> {
  const redis = getRedis();
  const ids = await redis.zrange("goal:weeks", 0, -1, { rev: true });
  return ids as string[];
}

// --- Weekly Tasks ---

/** Backfill old `deadline` → `estimatedDeadline` for tasks not yet migrated. */
function migrateTaskFields(task: Record<string, unknown>): WeeklyTask {
  if ("deadline" in task && !("estimatedDeadline" in task)) {
    const { deadline, ...rest } = task;
    return { ...rest, estimatedDeadline: deadline } as unknown as WeeklyTask;
  }
  return task as unknown as WeeklyTask;
}

export async function getWeeklyTasks(weekId: string): Promise<WeeklyTask[]> {
  const redis = getRedis();
  const data = await redis.get<string>(`goal:week:${weekId}`);
  if (!data) return [];
  const raw: Record<string, unknown>[] = typeof data === "string" ? JSON.parse(data) : data;
  return raw.map(migrateTaskFields);
}

export async function saveWeeklyTasks(
  weekId: string,
  tasks: WeeklyTask[]
): Promise<void> {
  const redis = getRedis();
  await redis.set(`goal:week:${weekId}`, JSON.stringify(tasks));
  const { start } = getWeekRange(weekId);
  await redis.zadd("goal:weeks", { score: start.getTime(), member: weekId });
}

export async function deleteWeeklyTasks(weekId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`goal:week:${weekId}`);
  await redis.zrem("goal:weeks", weekId);
}
