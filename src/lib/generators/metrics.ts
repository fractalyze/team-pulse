// Copyright 2026 Fractalyze Inc. All rights reserved.

import type {
  WeeklySnapshot,
  WeeklyDelta,
  GitHubMetrics,
  ContextSyncMetrics,
  OKRMetrics,
  CrossRepoMilestone,
  MilestoneMetadata,
  MilestonePRRef,
  RepoMilestoneDetail,
  PRInfo,
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
  crossRepoMilestones: CrossRepoMilestone[] = [],
): WeeklySnapshot {
  return {
    weekId,
    collectedAt: new Date().toISOString(),
    github,
    contextSync,
    okr,
    crossRepoMilestones,
  };
}

export const UNASSIGNED_TITLE = "__unassigned__";

/** Build cross-repo milestones from collected PR data + milestone metadata. */
export function buildCrossRepoMilestones(
  github: GitHubMetrics,
  milestonesMeta: MilestoneMetadata[],
): CrossRepoMilestone[] {
  // 1. Group PRs by milestone title → repo → PRs
  const prsByMilestone = new Map<string, Map<string, PRInfo[]>>();
  const unassignedByRepo = new Map<string, PRInfo[]>();

  for (const repoSummary of github.repos) {
    const allPRs = [...repoSummary.merged, ...repoSummary.open];
    for (const pr of allPRs) {
      if (!pr.milestone) {
        let repoPRs = unassignedByRepo.get(pr.repo);
        if (!repoPRs) {
          repoPRs = [];
          unassignedByRepo.set(pr.repo, repoPRs);
        }
        repoPRs.push(pr);
        continue;
      }

      let repoMap = prsByMilestone.get(pr.milestone);
      if (!repoMap) {
        repoMap = new Map();
        prsByMilestone.set(pr.milestone, repoMap);
      }

      let repoPRs = repoMap.get(pr.repo);
      if (!repoPRs) {
        repoPRs = [];
        repoMap.set(pr.repo, repoPRs);
      }

      repoPRs.push(pr);
    }
  }

  // 2. Build CrossRepoMilestone[] from metadata + PR data
  const metaByTitle = new Map<string, MilestoneMetadata>();
  for (const meta of milestonesMeta) {
    metaByTitle.set(meta.title, meta);
  }

  // Collect all milestone titles (from metadata + PR data)
  const allTitles = new Set([
    ...metaByTitle.keys(),
    ...prsByMilestone.keys(),
  ]);

  const results: CrossRepoMilestone[] = [];

  for (const title of allTitles) {
    const meta = metaByTitle.get(title);
    const repoMap = prsByMilestone.get(title);

    const repos: RepoMilestoneDetail[] = [];
    let mergedCount = 0;
    let openCount = 0;

    if (repoMap) {
      for (const [repo, prs] of repoMap) {
        const prRefs: MilestonePRRef[] = prs.map((pr) => ({
          repo,
          number: pr.number,
          title: pr.title,
          author: pr.author,
          url: pr.url,
          state: pr.state === "merged" ? "merged"
            : pr.state === "open" ? "open"
            : "closed",
        }));

        for (const ref of prRefs) {
          if (ref.state === "merged") mergedCount++;
          else if (ref.state === "open") openCount++;
        }

        repos.push({ repo, prs: prRefs });
      }
    }

    results.push({
      title,
      description: meta?.description ?? "",
      dueOn: meta?.dueOn ?? null,
      repos,
      mergedCount,
      openCount,
    });
  }

  // 3. Sort: dueOn first (ascending), then alphabetical
  results.sort((a, b) => {
    if (a.dueOn && b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.dueOn) return -1;
    if (b.dueOn) return 1;
    return a.title.localeCompare(b.title);
  });

  // 4. Append unassigned PRs group (always at the end)
  if (unassignedByRepo.size > 0) {
    const repos: RepoMilestoneDetail[] = [];
    let mergedCount = 0;
    let openCount = 0;

    for (const [repo, prs] of unassignedByRepo) {
      const prRefs: MilestonePRRef[] = prs.map((pr) => ({
        repo,
        number: pr.number,
        title: pr.title,
        author: pr.author,
        url: pr.url,
        state: pr.state === "merged" ? "merged"
          : pr.state === "open" ? "open"
          : "closed",
      }));

      for (const ref of prRefs) {
        if (ref.state === "merged") mergedCount++;
        else if (ref.state === "open") openCount++;
      }

      repos.push({ repo, prs: prRefs });
    }

    results.push({
      title: UNASSIGNED_TITLE,
      description: "",
      dueOn: null,
      repos,
      mergedCount,
      openCount,
    });
  }

  return results;
}
