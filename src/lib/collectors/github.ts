// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Octokit } from "@octokit/rest";
import { ORG, MONITORED_REPOS, OKR_REPO_MAP } from "../config";
import type { TeamMember } from "../types";
import { getWeekRange } from "../week";
import type {
  PRInfo,
  RepoPRSummary,
  GitHubMetrics,
  ReviewInfo,
  ReviewHealthMetrics,
  CrossRepoMilestone,
  MilestonePRRef,
  RepoMilestoneDetail,
} from "../types";

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return new Octokit({ auth: token });
}

/** Collect merged PRs for a repo within a date range. */
async function collectMergedPRs(
  octokit: Octokit,
  repo: string,
  since: Date,
  until: Date
): Promise<PRInfo[]> {
  const prs: PRInfo[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.pulls.list({
      owner: ORG,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 100,
      page,
    });

    if (data.length === 0) break;

    let hasRelevant = false;
    for (const pr of data) {
      if (!pr.merged_at) continue;
      const mergedAt = new Date(pr.merged_at);
      if (mergedAt < since) continue;
      if (mergedAt > until) {
        hasRelevant = true;
        continue;
      }
      hasRelevant = true;

      const createdAt = new Date(pr.created_at);
      const leadTimeMs = mergedAt.getTime() - createdAt.getTime();
      const leadTimeDays = Math.round((leadTimeMs / 86400000) * 10) / 10;

      prs.push({
        repo,
        number: pr.number,
        title: pr.title,
        author: pr.user?.login ?? "unknown",
        url: pr.html_url,
        state: "merged",
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
        closedAt: pr.closed_at,
        reviewers: pr.requested_reviewers?.map((r) => r.login) ?? [],
        leadTimeDays,
        body: pr.body ? pr.body.slice(0, 500) : null,
        additions: (pr as Record<string, unknown>).additions as number ?? 0,
        deletions: (pr as Record<string, unknown>).deletions as number ?? 0,
        changedFiles: (pr as Record<string, unknown>).changed_files as number ?? 0,
        milestone: pr.milestone?.title ?? null,
      });
    }

    // If the oldest updated PR on this page is before our window, stop
    const oldest = data[data.length - 1];
    if (!hasRelevant || new Date(oldest.updated_at) < since) break;
    page++;
  }

  return prs;
}

/** Collect currently open PRs for a repo. */
async function collectOpenPRs(
  octokit: Octokit,
  repo: string
): Promise<PRInfo[]> {
  const prs: PRInfo[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.pulls.list({
      owner: ORG,
      repo,
      state: "open",
      per_page: 100,
      page,
    });

    if (data.length === 0) break;

    for (const pr of data) {
      if (pr.draft) continue;
      prs.push({
        repo,
        number: pr.number,
        title: pr.title,
        author: pr.user?.login ?? "unknown",
        url: pr.html_url,
        state: "open",
        createdAt: pr.created_at,
        mergedAt: null,
        closedAt: null,
        reviewers: pr.requested_reviewers?.map((r) => r.login) ?? [],
        leadTimeDays: null,
        body: pr.body ? pr.body.slice(0, 500) : null,
        additions: (pr as Record<string, unknown>).additions as number ?? 0,
        deletions: (pr as Record<string, unknown>).deletions as number ?? 0,
        changedFiles: (pr as Record<string, unknown>).changed_files as number ?? 0,
        milestone: pr.milestone?.title ?? null,
      });
    }

    page++;
  }

  return prs;
}

/** Collect commit counts for a repo within a date range. */
async function collectCommitCounts(
  octokit: Octokit,
  repo: string,
  since: Date,
  until: Date
): Promise<Record<string, number>> {
  const byAuthor: Record<string, number> = {};
  let total = 0;
  let page = 1;

  while (true) {
    const { data } = await octokit.repos.listCommits({
      owner: ORG,
      repo,
      since: since.toISOString(),
      until: until.toISOString(),
      per_page: 100,
      page,
    });

    if (data.length === 0) break;

    for (const commit of data) {
      const author = commit.author?.login ?? "unknown";
      byAuthor[author] = (byAuthor[author] ?? 0) + 1;
      total++;
    }

    if (data.length < 100) break;
    page++;
  }

  byAuthor["__total__"] = total;
  return byAuthor;
}

/** Collect reviews for merged PRs. */
async function collectPRReviews(
  octokit: Octokit,
  repo: string,
  mergedPRs: PRInfo[]
): Promise<ReviewInfo[]> {
  const reviews: ReviewInfo[] = [];

  for (const pr of mergedPRs) {
    try {
      const { data } = await octokit.pulls.listReviews({
        owner: ORG,
        repo,
        pull_number: pr.number,
      });

      for (const review of data) {
        if (!review.user?.login || !review.submitted_at) continue;
        reviews.push({
          prNumber: pr.number,
          repo,
          reviewer: review.user.login,
          state: review.state as ReviewInfo["state"],
          submittedAt: review.submitted_at,
        });
      }
    } catch (error) {
      console.warn(
        `Failed to collect reviews for ${repo}#${pr.number}:`,
        error
      );
    }
  }

  return reviews;
}

/** Check if a reviewer is a bot. */
function isBot(login: string): boolean {
  return login.endsWith("[bot]") || login === "github-actions";
}

/** Compute review health metrics from review data and merged PRs. */
function computeReviewHealth(
  allReviews: ReviewInfo[],
  allMergedPRs: PRInfo[]
): ReviewHealthMetrics {
  const byReviewer: Record<string, number> = {};
  let totalApprovals = 0;

  // Build PR lookup
  const prsByKey = new Map<string, PRInfo>();
  for (const pr of allMergedPRs) {
    prsByKey.set(`${pr.repo}#${pr.number}`, pr);
  }

  // Filter out bot reviews and self-reviews
  const humanReviews = allReviews.filter((review) => {
    if (isBot(review.reviewer)) return false;
    const pr = prsByKey.get(`${review.repo}#${review.prNumber}`);
    if (pr && review.reviewer === pr.author) return false;
    return true;
  });

  for (const review of humanReviews) {
    byReviewer[review.reviewer] = (byReviewer[review.reviewer] ?? 0) + 1;
    if (review.state === "APPROVED") totalApprovals++;
  }

  // Compute first-review latency (filtered)
  const latencies: number[] = [];
  const reviewedPRs = new Set<string>();
  for (const review of humanReviews) {
    const key = `${review.repo}#${review.prNumber}`;
    if (reviewedPRs.has(key)) continue;
    reviewedPRs.add(key);

    const pr = prsByKey.get(key);
    if (!pr) continue;

    const prCreated = new Date(pr.createdAt).getTime();
    const reviewTime = new Date(review.submittedAt).getTime();
    const latencyHours = (reviewTime - prCreated) / (1000 * 60 * 60);
    if (latencyHours >= 0) latencies.push(latencyHours);
  }

  // Unreviewed PRs (no human review)
  const unreviewedPRKeys = allMergedPRs
    .filter((pr) => !reviewedPRs.has(`${pr.repo}#${pr.number}`))
    .map((pr) => `${pr.repo}#${pr.number}`);

  // Avg lead time: PR open → merge (hours)
  const leadTimes = allMergedPRs
    .filter((pr) => pr.mergedAt)
    .map((pr) => {
      const created = new Date(pr.createdAt).getTime();
      const merged = new Date(pr.mergedAt!).getTime();
      return (merged - created) / (1000 * 60 * 60);
    });
  const avgLeadTimeHours =
    leadTimes.length > 0
      ? Math.round(
          (leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) * 10
        ) / 10
      : null;

  // Reviewer participation: how many PRs had all requested reviewers participate?
  const actualReviewersByPR = new Map<string, Set<string>>();
  for (const review of humanReviews) {
    const key = `${review.repo}#${review.prNumber}`;
    if (!actualReviewersByPR.has(key)) actualReviewersByPR.set(key, new Set());
    actualReviewersByPR.get(key)!.add(review.reviewer);
  }

  // Track which requested reviewers didn't participate per PR
  const missedReviews: { prKey: string; missedReviewers: string[] }[] = [];
  const prsWithRequestedReviewers = allMergedPRs.filter(
    (pr) => pr.reviewers.length > 0
  );

  for (const pr of prsWithRequestedReviewers) {
    const key = `${pr.repo}#${pr.number}`;
    const actual = actualReviewersByPR.get(key) ?? new Set();
    const missed = pr.reviewers.filter((r) => !actual.has(r) && !isBot(r));
    if (missed.length > 0) {
      missedReviews.push({ prKey: key, missedReviewers: missed });
    }
  }

  const avgReviewLatencyHours =
    latencies.length > 0
      ? Math.round(
          (latencies.reduce((a, b) => a + b, 0) / latencies.length) * 10
        ) / 10
      : null;

  return {
    totalReviews: humanReviews.length,
    totalApprovals,
    prsWithNoReview: unreviewedPRKeys.length,
    unreviewedPRKeys,
    avgReviewLatencyHours,
    avgLeadTimeHours,
    missedReviews,
    byReviewer,
  };
}

/** Collect GitHub PR metrics for a given week. */
export async function collectGitHubMetrics(
  weekId: string,
  team: TeamMember[] = []
): Promise<GitHubMetrics> {
  const octokit = getOctokit();
  const { start, end } = getWeekRange(weekId);

  const repos: RepoPRSummary[] = [];
  const byAuthor: Record<string, { merged: number; open: number }> = {};
  const byObjective: Record<string, number> = {};
  let totalMerged = 0;
  let totalOpen = 0;
  let totalCommits = 0;
  const commitsByAuthor: Record<string, number> = {};
  const allLeadTimes: number[] = [];
  const allReviews: ReviewInfo[] = [];
  const allMergedPRs: PRInfo[] = [];

  // Initialize team members
  for (const member of team) {
    byAuthor[member.github] = { merged: 0, open: 0 };
  }

  for (const repo of MONITORED_REPOS) {
    try {
      const [merged, open, commitCounts] = await Promise.all([
        collectMergedPRs(octokit, repo, start, end),
        collectOpenPRs(octokit, repo),
        collectCommitCounts(octokit, repo, start, end),
      ]);

      repos.push({
        repo,
        merged,
        open,
        totalMerged: merged.length,
        totalOpen: open.length,
      });

      totalMerged += merged.length;
      totalOpen += open.length;
      allMergedPRs.push(...merged);

      // Aggregate commits
      for (const [author, count] of Object.entries(commitCounts)) {
        if (author === "__total__") {
          totalCommits += count;
        } else {
          commitsByAuthor[author] = (commitsByAuthor[author] ?? 0) + count;
        }
      }

      // Aggregate by author
      for (const pr of merged) {
        if (!byAuthor[pr.author]) byAuthor[pr.author] = { merged: 0, open: 0 };
        byAuthor[pr.author].merged++;
        if (pr.leadTimeDays !== null) allLeadTimes.push(pr.leadTimeDays);
      }
      for (const pr of open) {
        if (!byAuthor[pr.author]) byAuthor[pr.author] = { merged: 0, open: 0 };
        byAuthor[pr.author].open++;
      }

      // Aggregate by objective
      const objective = OKR_REPO_MAP[repo] ?? "Other";
      byObjective[objective] = (byObjective[objective] ?? 0) + merged.length;

      // Collect reviews for merged PRs
      const reviews = await collectPRReviews(octokit, repo, merged);
      allReviews.push(...reviews);
    } catch (error) {
      console.warn(`Failed to collect PRs for ${repo}:`, error);
      repos.push({
        repo,
        merged: [],
        open: [],
        totalMerged: 0,
        totalOpen: 0,
      });
    }
  }

  const avgLeadTimeDays =
    allLeadTimes.length > 0
      ? Math.round(
          (allLeadTimes.reduce((a, b) => a + b, 0) / allLeadTimes.length) * 10
        ) / 10
      : null;

  const reviewHealth = computeReviewHealth(allReviews, allMergedPRs);

  return {
    weekId,
    repos,
    totalMerged,
    totalOpen,
    byAuthor,
    byObjective,
    avgLeadTimeDays,
    totalCommits,
    commitsByAuthor,
    reviewHealth,
  };
}

/** Collect cross-repo milestones by aggregating same-titled milestones across repos. */
export async function collectCrossRepoMilestones(): Promise<CrossRepoMilestone[]> {
  const octokit = getOctokit();

  // 1. Fetch open milestones from all repos
  const milestonesByTitle = new Map<string, {
    description: string;
    dueOn: string | null;
    repoMilestones: { repo: string; number: number }[];
  }>();

  for (const repo of MONITORED_REPOS) {
    try {
      const { data: milestones } = await octokit.issues.listMilestones({
        owner: ORG,
        repo,
        state: "open",
      });

      for (const ms of milestones) {
        const existing = milestonesByTitle.get(ms.title);
        if (existing) {
          existing.repoMilestones.push({ repo, number: ms.number });
        } else {
          milestonesByTitle.set(ms.title, {
            description: ms.description ?? "",
            dueOn: ms.due_on ? ms.due_on.slice(0, 10) : null,
            repoMilestones: [{ repo, number: ms.number }],
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to list milestones for ${repo}:`, error);
    }
  }

  // 2. For each milestone, fetch associated PRs
  const results: CrossRepoMilestone[] = [];

  for (const [title, info] of milestonesByTitle) {
    const repos: RepoMilestoneDetail[] = [];
    let mergedCount = 0;
    let openCount = 0;

    for (const { repo, number: msNumber } of info.repoMilestones) {
      try {
        const { data: issues } = await octokit.issues.listForRepo({
          owner: ORG,
          repo,
          milestone: String(msNumber),
          state: "all",
          per_page: 100,
        });

        const prs: MilestonePRRef[] = [];
        for (const issue of issues) {
          if (!issue.pull_request) continue;

          let state: MilestonePRRef["state"];
          if (issue.pull_request.merged_at) {
            state = "merged";
            mergedCount++;
          } else if (issue.state === "open") {
            state = "open";
            openCount++;
          } else {
            state = "closed";
          }

          prs.push({
            repo,
            number: issue.number,
            title: issue.title,
            author: issue.user?.login ?? "unknown",
            url: issue.html_url,
            state,
          });
        }

        if (prs.length > 0) {
          repos.push({ repo, prs });
        }
      } catch (error) {
        console.warn(
          `Failed to list issues for milestone "${title}" in ${repo}:`,
          error
        );
      }
    }

    results.push({
      title,
      description: info.description,
      dueOn: info.dueOn,
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

  return results;
}
