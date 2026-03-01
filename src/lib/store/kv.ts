// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Redis } from "@upstash/redis";
import type { WeeklySnapshot, DashboardSummary } from "../types";
import { getPreviousWeekId } from "../week";
import { computeDelta } from "../generators/metrics";

function getRedis(): Redis {
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

  // Also update the "latest" pointer
  await redis.set("snapshot:latest", snapshot.weekId);

  // Add to the sorted set of all week IDs for listing
  await redis.zadd("weeks", { score: Date.now(), member: snapshot.weekId });
}

/** Get a weekly snapshot by week ID. */
export async function getSnapshot(
  weekId: string
): Promise<WeeklySnapshot | null> {
  const redis = getRedis();
  const data = await redis.get<string>(snapshotKey(weekId));
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
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
  const targetWeekId = weekId ?? (await getLatestWeekId());
  if (!targetWeekId) return null;

  const current = await getSnapshot(targetWeekId);
  if (!current) return null;

  const previousWeekId = getPreviousWeekId(targetWeekId);
  const previous = await getSnapshot(previousWeekId);
  const delta = computeDelta(current, previous);

  return {
    current,
    delta,
    previousWeekId: previous ? previousWeekId : null,
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
