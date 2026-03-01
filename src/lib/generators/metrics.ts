// Copyright 2026 Fractalyze Inc. All rights reserved.

import type {
  WeeklySnapshot,
  WeeklyDelta,
  GitHubMetrics,
  ContextSyncMetrics,
  OKRMetrics,
  MemberMilestone,
} from "../types";
import { TEAM } from "../config";

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

/** Build member milestones from GitHub data. */
export function buildMilestones(github: GitHubMetrics): MemberMilestone[] {
  return TEAM.map((member) => {
    const mergedPRs = github.repos.flatMap((r) =>
      r.merged.filter(
        (pr) => member.github !== "TBD" && pr.author === member.github
      )
    );
    const openPRs = github.repos.flatMap((r) =>
      r.open.filter(
        (pr) => member.github !== "TBD" && pr.author === member.github
      )
    );

    const achieved = mergedPRs.map(
      (pr) => `PR#${pr.number} ${pr.repo}: ${pr.title}`
    );
    const blockingPoints = openPRs
      .filter((pr) => {
        const daysOpen = Math.floor(
          (Date.now() - new Date(pr.createdAt).getTime()) / 86400000
        );
        return daysOpen >= 3;
      })
      .map((pr) => {
        const daysOpen = Math.floor(
          (Date.now() - new Date(pr.createdAt).getTime()) / 86400000
        );
        return `PR#${pr.number} ${pr.repo}: ${daysOpen}일간 리뷰 대기`;
      });

    return {
      name: member.name,
      achieved,
      blockingPoints,
      nextWeekGoals: [],
    };
  });
}

/** Assemble a complete weekly snapshot. */
export function assembleSnapshot(
  weekId: string,
  github: GitHubMetrics,
  contextSync: ContextSyncMetrics,
  okr: OKRMetrics
): WeeklySnapshot {
  return {
    weekId,
    collectedAt: new Date().toISOString(),
    github,
    contextSync,
    milestones: buildMilestones(github),
    okr,
  };
}
