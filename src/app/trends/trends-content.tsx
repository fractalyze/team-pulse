// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import {
  PRTrendChart,
  VelocityTrendChart,
  ReviewLatencyTrendChart,
  ReviewByReviewerTrendChart,
  PendingReviewTrendChart,
  DeadlineAccuracyTrendChart,
} from "@/components/charts/trend-line";
import { VelocityBarChart } from "@/components/charts/velocity-bar";
import type { WeeklySnapshot, WeeklyPendingReviews } from "@/lib/types";

interface DeadlineAccuracyPoint {
  weekId: string;
  onTimeRate: number;
  avgDeltaDays: number | null;
}

interface TrendsContentProps {
  snapshots: WeeklySnapshot[];
  displayNames?: Record<string, string>;
  pendingByWeek?: Record<string, WeeklyPendingReviews>;
  deadlineAccuracy?: DeadlineAccuracyPoint[];
}

export function TrendsContent({ snapshots, displayNames, pendingByWeek = {}, deadlineAccuracy = [] }: TrendsContentProps) {
  return (
    <div className="space-y-6">
      {/* Deadline Accuracy Trend */}
      {deadlineAccuracy.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Deadline Accuracy Trend
          </h2>
          <DeadlineAccuracyTrendChart data={deadlineAccuracy} />
        </div>
      )}

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

      {/* Reviews by Reviewer Trend */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Reviews by Reviewer
        </h2>
        <ReviewByReviewerTrendChart snapshots={snapshots} displayNames={displayNames} />
      </div>

      {/* Pending Reviews Trend (Daily) */}
      {Object.keys(pendingByWeek).length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Pending Reviews (Daily Trend)
          </h2>
          <PendingReviewTrendChart
            pendingByWeek={pendingByWeek}
            weekIds={snapshots.map((s) => s.weekId)}
            displayNames={displayNames}
          />
        </div>
      )}

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
