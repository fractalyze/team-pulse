// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Octokit } from "@octokit/rest";
import { ORG, MONITORED_REPOS, OKR_REPO_MAP, TEAM } from "../config";
import { getWeekRange } from "../week";
import type { PRInfo, RepoPRSummary, GitHubMetrics } from "../types";

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
      });
    }

    page++;
  }

  return prs;
}

/** Collect GitHub PR metrics for a given week. */
export async function collectGitHubMetrics(
  weekId: string
): Promise<GitHubMetrics> {
  const octokit = getOctokit();
  const { start, end } = getWeekRange(weekId);

  const repos: RepoPRSummary[] = [];
  const byAuthor: Record<string, { merged: number; open: number }> = {};
  const byObjective: Record<string, number> = {};
  let totalMerged = 0;
  let totalOpen = 0;
  const allLeadTimes: number[] = [];

  // Initialize team members
  for (const member of TEAM) {
    if (member.github !== "TBD") {
      byAuthor[member.github] = { merged: 0, open: 0 };
    }
  }

  for (const repo of MONITORED_REPOS) {
    try {
      const [merged, open] = await Promise.all([
        collectMergedPRs(octokit, repo, start, end),
        collectOpenPRs(octokit, repo),
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

  return {
    weekId,
    repos,
    totalMerged,
    totalOpen,
    byAuthor,
    byObjective,
    avgLeadTimeDays,
  };
}
