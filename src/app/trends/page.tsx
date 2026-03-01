// Copyright 2026 Fractalyze Inc. All rights reserved.

import type { WeeklySnapshot } from "@/lib/types";
import { getSnapshots } from "@/lib/store/kv";
import { TrendsContent } from "./trends-content";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  let snapshots: WeeklySnapshot[] = [];
  try {
    snapshots = await getSnapshots(12);
  } catch {
    // KV not configured yet
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
      <TrendsContent snapshots={snapshots} />
    </div>
  );
}
