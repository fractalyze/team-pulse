// Copyright 2026 Fractalyze Inc. All rights reserved.

import type { WeeklyTask } from "./types";

export interface DeadlineAccuracy {
  avgDeltaDays: number | null; // positive = early, negative = late
  onTimeCount: number;
  lateCount: number;
  totalMeasurable: number;
  onTimeRate: number; // 0-100
}

/** Compute deadline accuracy for a set of weekly tasks.
 *  Only tasks with status "done" and both estimatedDeadline and actualDeadline are measured.
 *  deltaDays = estimatedDeadline - actualDeadline (positive = finished early, negative = late).
 */
export function computeDeadlineAccuracy(
  tasks: WeeklyTask[]
): DeadlineAccuracy {
  const measurable = tasks.filter(
    (t) => t.status === "done" && t.estimatedDeadline && t.actualDeadline
  );

  if (measurable.length === 0) {
    return {
      avgDeltaDays: null,
      onTimeCount: 0,
      lateCount: 0,
      totalMeasurable: 0,
      onTimeRate: 0,
    };
  }

  let totalDelta = 0;
  let onTime = 0;
  let late = 0;

  for (const t of measurable) {
    const estimated = new Date(t.estimatedDeadline).getTime();
    const actual = new Date(t.actualDeadline!).getTime();
    const deltaDays = (estimated - actual) / 86_400_000;
    totalDelta += deltaDays;
    if (deltaDays >= 0) {
      onTime++;
    } else {
      late++;
    }
  }

  return {
    avgDeltaDays: Math.round((totalDelta / measurable.length) * 10) / 10,
    onTimeCount: onTime,
    lateCount: late,
    totalMeasurable: measurable.length,
    onTimeRate: Math.round((onTime / measurable.length) * 100),
  };
}
