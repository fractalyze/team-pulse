// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Suspense } from "react";
import { getDashboardSummary, getSnapshot, getRedis } from "@/lib/store/kv";
import { getPreviousWeekId } from "@/lib/week";
import { GoalProgressServer } from "@/components/goals/goal-progress-server";
import { GoalProgressSkeleton } from "@/components/goals/goal-progress-skeleton";
import { DashboardContent } from "./dashboard-content";
import { WeekNav } from "./week-nav";

export const dynamic = "force-dynamic";

export default async function Home() {
  let summary = null;

  try {
    summary = await getDashboardSummary();
  } catch {
    // KV not configured yet — show empty state
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Team Pulse
        </h1>
        <p className="text-gray-500">
          No data yet. Run the cron job or trigger manually to collect metrics.
        </p>
        <code className="rounded bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800">
          POST /api/trigger
        </code>
      </div>
    );
  }

  // Fetch previous week snapshot and display names
  let previousSnapshot = null;
  let displayNames: Record<string, string> = {};
  try {
    const prevWeekId = getPreviousWeekId(summary.current.weekId);
    const [prevSnap, dnData] = await Promise.all([
      getSnapshot(prevWeekId),
      getRedis().get<string>("config:displaynames"),
    ]);
    previousSnapshot = prevSnap;
    if (dnData) {
      displayNames = typeof dnData === "string" ? JSON.parse(dnData) : dnData;
    }
  } catch {
    // Previous week data not available
  }

  return (
    <div className="space-y-6">
      <WeekNav summary={summary} />
      <Suspense fallback={<GoalProgressSkeleton />}>
        <GoalProgressServer weekId={summary.current.weekId} />
      </Suspense>
      <DashboardContent summary={summary} previousSnapshot={previousSnapshot} displayNames={displayNames} />
    </div>
  );
}
