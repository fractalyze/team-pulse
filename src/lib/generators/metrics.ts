// Copyright 2026 Fractalyze Inc. All rights reserved.

import type {
  WeeklySnapshot,
  WeeklyDelta,
  GitHubMetrics,
  ContextSyncMetrics,
  OKRMetrics,
  ProjectMetrics,
} from "../types";

/** Compute week-over-week delta between current and previous snapshots. */
export function computeDelta(
  current: WeeklySnapshot,
  previous: WeeklySnapshot | null
): WeeklyDelta | null {
  if (!previous) return null;

  const avgLatencyCurrent =
    current.github.reviewHealth.avgReviewLatencyHours;
  const avgLatencyPrev =
    previous.github.reviewHealth.avgReviewLatencyHours;

  return {
    prsMergedDelta: current.github.totalMerged - previous.github.totalMerged,
    prsOpenDelta: current.github.totalOpen - previous.github.totalOpen,
    contextSyncSessionsDelta:
      current.contextSync.totalSessions - previous.contextSync.totalSessions,
    commitsDelta: current.github.totalCommits - previous.github.totalCommits,
    avgReviewLatencyDelta:
      avgLatencyCurrent !== null && avgLatencyPrev !== null
        ? Math.round((avgLatencyCurrent - avgLatencyPrev) * 10) / 10
        : null,
    unreviewedMergesDelta:
      current.github.reviewHealth.prsWithNoReview -
      previous.github.reviewHealth.prsWithNoReview,
  };
}

/** Assemble a complete weekly snapshot. */
export function assembleSnapshot(
  weekId: string,
  github: GitHubMetrics,
  contextSync: ContextSyncMetrics,
  okr: OKRMetrics,
  project?: ProjectMetrics,
): WeeklySnapshot {
  const snapshot: WeeklySnapshot = {
    weekId,
    collectedAt: new Date().toISOString(),
    github,
    contextSync,
    okr,
  };
  if (project) snapshot.project = project;
  return snapshot;
}
