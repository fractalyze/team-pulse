// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import {
  PRTrendChart,
  VelocityTrendChart,
  ReviewLatencyTrendChart,
} from "@/components/charts/trend-line";
import { VelocityBarChart } from "@/components/charts/velocity-bar";
import type { WeeklySnapshot } from "@/lib/types";

interface TrendsContentProps {
  snapshots: WeeklySnapshot[];
}

export function TrendsContent({ snapshots }: TrendsContentProps) {
  return (
    <div className="space-y-6">
      {/* Team Velocity (stacked bar by member) */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Team Velocity (PRs Merged by Member)
        </h2>
        <VelocityBarChart snapshots={snapshots} />
      </div>

      {/* Velocity Trend (commits + PRs dual axis) */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Velocity Trend (Commits + PRs)
        </h2>
        <VelocityTrendChart snapshots={snapshots} />
      </div>

      {/* Review Latency Trend */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Review Latency Trend
        </h2>
        <ReviewLatencyTrendChart snapshots={snapshots} />
      </div>

      {/* PR Velocity (merged + open line) */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          PR Velocity (Merged vs Open)
        </h2>
        <PRTrendChart snapshots={snapshots} />
      </div>

    </div>
  );
}
