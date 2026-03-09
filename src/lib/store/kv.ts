// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Redis } from "@upstash/redis";
import type { WeeklySnapshot, DashboardSummary } from "../types";
import { getPreviousWeekId, getWeekRange } from "../week";
import { buildCrossRepoMilestones, computeDelta } from "../generators/metrics";

export function getRedis(): Redis {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("KV_REST_API_URL or KV_REST_API_TOKEN is not set");
  return new Redis({ url, token });
}

function snapshotKey(weekId: string): string {
  return `snapshot:${weekId}`;
}

/** Save a weekly snapshot to KV. */
export async function saveSnapshot(snapshot: WeeklySnapshot): Promise<void> {
  const redis = getRedis();
  await redis.set(snapshotKey(snapshot.weekId), JSON.stringify(snapshot));

  // Use the week's start date as score so weeks sort chronologically
  const { start } = getWeekRange(snapshot.weekId);
  await redis.zadd("weeks", { score: start.getTime(), member: snapshot.weekId });

  // Update "latest" pointer only if this week is newer than current latest
  const currentLatest = await redis.get<string>("snapshot:latest");
  if (!currentLatest || snapshot.weekId > currentLatest) {
    await redis.set("snapshot:latest", snapshot.weekId);
  }
}

/** Default review health for old snapshots without this field. */
const DEFAULT_REVIEW_HEALTH = {
  totalReviews: 0,
  totalApprovals: 0,
  prsWithNoReview: 0,
  unreviewedPRKeys: [],
  avgReviewLatencyHours: null,
  avgLeadTimeHours: null,
  missedReviews: [],
  byReviewer: {},
};

/** Backfill missing fields for old snapshots. */
function backfillSnapshot(snapshot: WeeklySnapshot): WeeklySnapshot {
  const github = snapshot.github;
  return {
    ...snapshot,
    github: {
      ...github,
      totalCommits: github.totalCommits ?? 0,
      commitsByAuthor: github.commitsByAuthor ?? {},
      reviewHealth: github.reviewHealth ?? DEFAULT_REVIEW_HEALTH,
    },
    okr: snapshot.okr ?? {
      weekId: snapshot.weekId,
      objectives: [],
      thisWeekGoal: null,
      nextHardDeadline: null,
    },
    crossRepoMilestones:
      snapshot.crossRepoMilestones?.some(
        (ms) => ms.mergedCount + ms.openCount > 0,
      )
        ? snapshot.crossRepoMilestones
        : buildCrossRepoMilestones(snapshot.github, []),
  };
}

/** Get a weekly snapshot by week ID. */
export async function getSnapshot(
  weekId: string
): Promise<WeeklySnapshot | null> {
  const redis = getRedis();
  const data = await redis.get<string>(snapshotKey(weekId));
  if (!data) return null;
  const snapshot: WeeklySnapshot =
    typeof data === "string" ? JSON.parse(data) : data;
  return backfillSnapshot(snapshot);
}

/** Get the latest week ID. */
export async function getLatestWeekId(): Promise<string | null> {
  const redis = getRedis();
  return redis.get<string>("snapshot:latest");
}

/** Get all week IDs in reverse chronological order. */
export async function getAllWeekIds(): Promise<string[]> {
  const redis = getRedis();
  const ids = await redis.zrange("weeks", 0, -1, { rev: true });
  return ids as string[];
}

/** Get the dashboard summary (current + delta). */
export async function getDashboardSummary(
  weekId?: string
): Promise<DashboardSummary | null> {
  const allWeekIds = await getAllWeekIds(); // newest first
  const targetWeekId = weekId ?? (await getLatestWeekId());
  if (!targetWeekId) return null;

  const current = await getSnapshot(targetWeekId);
  if (!current) return null;

  const previousWeekId = getPreviousWeekId(targetWeekId);
  const previous = await getSnapshot(previousWeekId);
  const delta = computeDelta(current, previous);

  // Find next week (the one after this in chronological order)
  const idx = allWeekIds.indexOf(targetWeekId);
  const nextWeekId = idx > 0 ? allWeekIds[idx - 1] : null;

  return {
    current,
    delta,
    previousWeekId: previous ? previousWeekId : null,
    nextWeekId,
    allWeekIds,
  };
}

/** Get multiple snapshots for trend charts. */
export async function getSnapshots(
  count: number = 8
): Promise<WeeklySnapshot[]> {
  const weekIds = await getAllWeekIds();
  const targetIds = weekIds.slice(0, count);

  const snapshots: WeeklySnapshot[] = [];
  for (const id of targetIds) {
    const snapshot = await getSnapshot(id);
    if (snapshot) snapshots.push(snapshot);
  }

  return snapshots.reverse(); // chronological order
}
