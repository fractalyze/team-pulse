// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Suspense } from "react";
import { getDashboardSummary } from "@/lib/store/kv";
import { GoalProgressServer } from "@/components/goals/goal-progress-server";
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

  return (
    <div className="space-y-6">
      <WeekNav summary={summary} />
      <Suspense>
        <GoalProgressServer weekId={summary.current.weekId} />
      </Suspense>
      <DashboardContent summary={summary} />

      {/* Member milestones */}
      {summary.current.milestones.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Team Milestones
          </h2>
          <div className="space-y-4">
            {summary.current.milestones.map((m) => (
              <div
                key={m.name}
                className="rounded border border-gray-200 p-3 dark:border-gray-700"
              >
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {m.name}
                </h3>
                {m.achieved.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-green-600">
                      Achieved:
                    </span>
                    <ul className="ml-4 list-disc text-sm text-gray-700 dark:text-gray-300">
                      {m.achieved.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.blockingPoints.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-red-600">
                      Blocking:
                    </span>
                    <ul className="ml-4 list-disc text-sm text-gray-700 dark:text-gray-300">
                      {m.blockingPoints.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.achieved.length === 0 && m.blockingPoints.length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">No data</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
