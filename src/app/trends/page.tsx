// Copyright 2026 Fractalyze Inc. All rights reserved.

import type { WeeklySnapshot, WeeklyPendingReviews } from "@/lib/types";
import { getSnapshots, getRedis, getDailyPending } from "@/lib/store/kv";
import { getMergedWeeklyTasks } from "@/lib/store/goals-merged";
import { computeDeadlineAccuracy } from "@/lib/deadline-accuracy";
import { TrendsContent } from "./trends-content";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  let snapshots: WeeklySnapshot[] = [];
  let displayNames: Record<string, string> = {};
  try {
    const [snaps, dnData] = await Promise.all([
      getSnapshots(12),
      getRedis().get<string>("config:displaynames"),
    ]);
    snapshots = snaps;
    if (dnData) {
      displayNames = typeof dnData === "string" ? JSON.parse(dnData) : dnData;
    }
  } catch {
    // KV not configured yet
  }

  // Fetch daily pending data for each snapshot week
  const pendingByWeek: Record<string, WeeklyPendingReviews> = {};
  try {
    const results = await Promise.all(
      snapshots.map((s) => getDailyPending(s.weekId))
    );
    for (let i = 0; i < snapshots.length; i++) {
      if (results[i]) pendingByWeek[snapshots[i].weekId] = results[i]!;
    }
  } catch {
    // Pending data not available
  }

  // Compute deadline accuracy per week
  const deadlineAccuracy: { weekId: string; onTimeRate: number; avgDeltaDays: number | null }[] = [];
  try {
    const results = await Promise.all(
      snapshots.map(async (s) => {
        const tasks = await getMergedWeeklyTasks(s.weekId);
        return { weekId: s.weekId, ...computeDeadlineAccuracy(tasks) };
      })
    );
    deadlineAccuracy.push(...results);
  } catch {
    // Deadline accuracy data not available
  }

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Trends
        </h1>
        <p className="text-gray-500">
          Not enough data for trends. Need at least 2 weeks of data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Trends ({snapshots.length} weeks)
      </h1>
      <TrendsContent snapshots={snapshots} displayNames={displayNames} pendingByWeek={pendingByWeek} deadlineAccuracy={deadlineAccuracy} />
    </div>
  );
}
