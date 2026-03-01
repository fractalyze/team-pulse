// Copyright 2026 Fractalyze Inc. All rights reserved.

import Link from "next/link";
import { getDashboardSummary, getAllWeekIds } from "@/lib/store/kv";
import { DashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";

export default async function Home() {
  let summary = null;
  let weekIds: string[] = [];

  try {
    summary = await getDashboardSummary();
    weekIds = await getAllWeekIds();
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Week {summary.current.weekId}
        </h1>
        <div className="flex gap-2">
          {weekIds.slice(0, 5).map((id) => (
            <Link
              key={id}
              href={`/week/${id}`}
              className={`rounded px-3 py-1 text-sm ${
                id === summary!.current.weekId
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {id.replace(/^\d{4}-/, "")}
            </Link>
          ))}
        </div>
      </div>

      <DashboardContent summary={summary} />
    </div>
  );
}
