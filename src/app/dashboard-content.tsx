// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useState } from "react";
import { MetricCard } from "@/components/charts/metric-card";
import { PRActivityChart } from "@/components/charts/pr-activity";
import type { DashboardSummary, WeeklySnapshot, PRInfo, ProjectItem, GoalProgressSummary } from "@/lib/types";

interface DashboardContentProps {
  summary: DashboardSummary;
  previousSnapshot?: WeeklySnapshot | null;
  displayNames?: Record<string, string>;
}

function reviewLatencyColor(
  hours: number | null
): "green" | "yellow" | "red" {
  if (hours === null) return "green";
  if (hours < 24) return "green";
  if (hours < 48) return "yellow";
  return "red";
}

function unreviewedColor(count: number): "green" | "yellow" | "red" {
  if (count === 0) return "green";
  if (count <= 2) return "yellow";
  return "red";
}

function actionItemsColor(
  done: number,
  total: number
): "green" | "yellow" | "red" {
  if (total === 0) return "green";
  const pct = (done / total) * 100;
  if (pct > 80) return "green";
  if (pct > 50) return "yellow";
  return "red";
}

/** Count business days (Mon-Fri) between two dates. */
function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

/** Get stale color for review queue PRs (business days). */
function reviewStaleColor(bizDays: number): string {
  if (bizDays >= 5) return "text-red-600";
  if (bizDays >= 3) return "text-yellow-600";
  return "text-gray-700 dark:text-gray-300";
}

/** Get stale color for draft queue PRs (business days). */
function draftStaleColor(bizDays: number): string {
  if (bizDays >= 10) return "text-red-600";
  if (bizDays >= 5) return "text-yellow-600";
  return "text-gray-700 dark:text-gray-300";
}

/** Status badge for project items. */
function StatusBadge({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    Merged: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    "In Review": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    Draft: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    Closed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
  const s = status ?? "Unknown";
  return (
    <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${colors[s] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
      {s}
    </span>
  );
}

export function DashboardContent({ summary, previousSnapshot, displayNames = {} }: DashboardContentProps) {
  const dn = (name: string) => displayNames[name] ?? name;

  const { current, delta } = summary;
  const { github, contextSync } = current;
  const project = current.project;
  const previousProject = previousSnapshot?.project ?? null;
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [retroExpanded, setRetroExpanded] = useState(false);
  const [goalHealthExpanded, setGoalHealthExpanded] = useState(false);
  const [individualExpanded, setIndividualExpanded] = useState(false);

  const repoCount = github.repos.filter((r) => r.totalMerged > 0).length;
  const avgLeadTime = github.reviewHealth.avgLeadTimeHours;
  const leadTimeStr =
    avgLeadTime !== null
      ? avgLeadTime >= 24
        ? `${Math.round(avgLeadTime / 24 * 10) / 10}d`
        : `${avgLeadTime}h`
      : "N/A";
  const avgLatency = github.reviewHealth.avgReviewLatencyHours;
  const latencyStr = avgLatency !== null ? `${avgLatency}h` : "N/A";
  const missedReviews = github.reviewHealth.missedReviews ?? [];

  const totalActions = contextSync.notes.reduce(
    (sum, n) => sum + n.actionItems.length,
    0
  );
  const pendingActions = contextSync.notes.reduce(
    (sum, n) => sum + n.actionItems.filter((a) => !a.done).length,
    0
  );
  const doneActions = totalActions - pendingActions;

  const allMergedPRs = github.repos.flatMap((r) => r.merged);
  const allOpenPRs = github.repos.flatMap((r) => r.open);

  // Split into Review Queue (non-draft) and Draft Queue
  const now = new Date();
  const reviewPRs = allOpenPRs
    .filter((pr) => !pr.draft)
    .map((pr) => {
      const refDate = new Date(pr.readyForReviewAt ?? pr.createdAt);
      const bizDays = businessDaysBetween(refDate, now);
      return { ...pr, bizDays };
    })
    .sort((a, b) => b.bizDays - a.bizDays);

  const draftPRs = allOpenPRs
    .filter((pr) => pr.draft)
    .map((pr) => {
      const bizDays = businessDaysBetween(new Date(pr.createdAt), now);
      return { ...pr, bizDays };
    })
    .sort((a, b) => b.bizDays - a.bizDays);

  // Unreviewed merged PRs
  const unreviewedKeys = new Set(github.reviewHealth.unreviewedPRKeys ?? []);
  const unreviewedPRs = allMergedPRs.filter(
    (pr) => unreviewedKeys.has(`${pr.repo}#${pr.number}`)
  );

  // Review health: per-reviewer breakdown
  const reviewerEntries = Object.entries(github.reviewHealth.byReviewer)
    .sort((a, b) => b[1] - a[1]);

  const toggle = (card: string) =>
    setExpandedCard(expandedCard === card ? null : card);

  // Week-over-Week delta for goals
  const previousGoalMap = new Map<string, GoalProgressSummary>();
  if (previousProject) {
    for (const g of previousProject.goalProgress) {
      previousGoalMap.set(g.goalName, g);
    }
  }

  return (
    <>
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="cursor-pointer" onClick={() => toggle("merged")}>
          <MetricCard
            title="PRs Merged"
            value={github.totalMerged}
            delta={delta?.prsMergedDelta}
            subtitle={`across ${repoCount} repos`}
            color="green"
          />
        </div>
        <div className="cursor-pointer" onClick={() => toggle("commits")}>
          <MetricCard
            title="Commits"
            value={github.totalCommits}
            delta={delta?.commitsDelta}
            subtitle={`${Object.keys(github.commitsByAuthor).length} contributors`}
            color="green"
          />
        </div>
        <div className="cursor-pointer" onClick={() => toggle("review")}>
          <MetricCard
            title="Review Health"
            value={leadTimeStr}
            subtitle={`open → merge | ${missedReviews.length} missed`}
            color={reviewLatencyColor(avgLeadTime !== null ? avgLeadTime : null)}
          />
        </div>
        <div className="cursor-pointer" onClick={() => toggle("unreviewed")}>
          <MetricCard
            title="Unreviewed Merges"
            value={github.reviewHealth.prsWithNoReview}
            delta={delta?.unreviewedMergesDelta}
            subtitle={`of ${github.totalMerged} merged`}
            color={unreviewedColor(github.reviewHealth.prsWithNoReview)}
          />
        </div>
        <div className="cursor-pointer" onClick={() => toggle("open")}>
          <MetricCard
            title="PR Queue"
            value={github.totalOpen}
            delta={delta?.prsOpenDelta}
            subtitle={`${reviewPRs.length} in review · ${draftPRs.length} draft`}
            color="yellow"
          />
        </div>
        <div className="cursor-pointer" onClick={() => toggle("actions")}>
          <MetricCard
            title="Action Items"
            value={`${doneActions}/${totalActions}`}
            subtitle={`${contextSync.totalSessions} sync sessions`}
            color={actionItemsColor(doneActions, totalActions)}
          />
        </div>
      </div>

      {/* Expanded: Merged PRs table */}
      {expandedCard === "merged" && allMergedPRs.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Merged PRs ({allMergedPRs.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">PR</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Title</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Author</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Reviewers</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">Lead</th>
                </tr>
              </thead>
              <tbody>
                {allMergedPRs.map((pr) => (
                  <tr key={`${pr.repo}-${pr.number}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-1">
                      <a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {pr.repo}#{pr.number}
                      </a>
                    </td>
                    <td className="px-2 py-1 text-gray-700 dark:text-gray-300">
                      {pr.title.slice(0, 60)}{pr.title.length > 60 ? "..." : ""}
                    </td>
                    <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{dn(pr.author)}</td>
                    <td className="px-2 py-1">
                      {pr.reviewers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {pr.reviewers.map((r) => (
                            <span
                              key={r}
                              className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                            >
                              {dn(r)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-500">
                      {pr.leadTimeDays !== null ? `${pr.leadTimeDays}d` : "&mdash;"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expanded: Commits by author */}
      {expandedCard === "commits" && Object.keys(github.commitsByAuthor).length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Commits by Author ({github.totalCommits})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Author</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">Commits</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Share</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(github.commitsByAuthor)
                  .sort((a, b) => b[1] - a[1])
                  .map(([author, count]) => (
                    <tr key={author} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{dn(author)}</td>
                      <td className="px-2 py-1 text-right text-gray-700 dark:text-gray-300">{count}</td>
                      <td className="px-2 py-1">
                        <div className="h-4 w-24 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-full rounded bg-blue-500"
                            style={{ width: `${github.totalCommits > 0 ? (count / github.totalCommits) * 100 : 0}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expanded: Review health */}
      {expandedCard === "review" && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Review Breakdown
          </h2>
          <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded bg-gray-50 p-2 dark:bg-gray-800">
              <p className="text-gray-500">Open → Merge</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{leadTimeStr}</p>
            </div>
            <div className="rounded bg-gray-50 p-2 dark:bg-gray-800">
              <p className="text-gray-500">First Review</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{latencyStr}</p>
            </div>
            <div className="rounded bg-gray-50 p-2 dark:bg-gray-800">
              <p className="text-gray-500">Reviews (human)</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {github.reviewHealth.totalReviews}
                <span className="ml-1 text-sm font-normal text-green-600">
                  ({github.reviewHealth.totalApprovals} approved)
                </span>
              </p>
            </div>
          </div>
          {missedReviews.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-yellow-600">
                Missed Reviews ({missedReviews.length} PRs)
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">PR</th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Didn&apos;t Review</th>
                  </tr>
                </thead>
                <tbody>
                  {missedReviews.map((entry) => {
                    const pr = allMergedPRs.find(
                      (p) => `${p.repo}#${p.number}` === entry.prKey
                    );
                    return (
                      <tr key={entry.prKey} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-2 py-1">
                          {pr ? (
                            <a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {entry.prKey}
                            </a>
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">{entry.prKey}</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex flex-wrap gap-1">
                            {entry.missedReviewers.map((r) => (
                              <span
                                key={r}
                                className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900 dark:text-red-300"
                              >
                                {dn(r)}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {reviewerEntries.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Reviewer</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">Reviews</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Share</th>
                </tr>
              </thead>
              <tbody>
                {reviewerEntries.map(([reviewer, count]) => (
                  <tr key={reviewer} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{dn(reviewer)}</td>
                    <td className="px-2 py-1 text-right text-gray-700 dark:text-gray-300">{count}</td>
                    <td className="px-2 py-1">
                      <div className="h-4 w-24 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-full rounded bg-green-500"
                          style={{
                            width: `${github.reviewHealth.totalReviews > 0 ? (count / github.reviewHealth.totalReviews) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Expanded: Unreviewed merged PRs */}
      {expandedCard === "unreviewed" && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Unreviewed Merged PRs ({github.reviewHealth.prsWithNoReview})
          </h2>
          {unreviewedPRs.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">PR</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Title</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Author</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Reviewers</th>
                </tr>
              </thead>
              <tbody>
                {unreviewedPRs.map((pr) => (
                  <tr key={`${pr.repo}-${pr.number}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-1">
                      <a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {pr.repo}#{pr.number}
                      </a>
                    </td>
                    <td className="px-2 py-1 text-gray-700 dark:text-gray-300">
                      {pr.title.slice(0, 60)}{pr.title.length > 60 ? "..." : ""}
                    </td>
                    <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{dn(pr.author)}</td>
                    <td className="px-2 py-1">
                      {pr.reviewers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {pr.reviewers.map((r) => (
                            <span
                              key={r}
                              className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                            >
                              {dn(r)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">
              리뷰어 데이터는 API에서 수집한 review 기록 기준입니다. {github.reviewHealth.prsWithNoReview}건이 review 없이 머지됨.
            </p>
          )}
        </div>
      )}

      {/* Expanded: PR Queue (Review Queue + Draft Queue) */}
      {expandedCard === "open" && (reviewPRs.length > 0 || draftPRs.length > 0) && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          {/* Review Queue */}
          {reviewPRs.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Review Queue ({reviewPRs.length})
              </h2>
              <div className="overflow-x-auto">
                <PRQueueTable prs={reviewPRs} staleColorFn={reviewStaleColor} dn={dn} />
              </div>
            </div>
          )}
          {/* Draft Queue */}
          {draftPRs.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Draft Queue ({draftPRs.length})
              </h2>
              <div className="overflow-x-auto">
                <PRQueueTable prs={draftPRs} staleColorFn={draftStaleColor} dn={dn} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded: Action Items */}
      {expandedCard === "actions" && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Action Items ({pendingActions} pending / {totalActions} total)
          </h2>
          {contextSync.notes.length > 0 ? (
            <div className="space-y-3">
              {contextSync.notes
                .filter((note) => note.actionItems.length > 0)
                .map((note) => (
                  <div key={note.id} className="rounded border border-gray-200 p-3 dark:border-gray-700">
                    <p className="mb-2 text-sm font-medium text-gray-500">
                      {note.title || note.date}
                    </p>
                    <div className="space-y-1">
                      {note.actionItems.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className={`mt-0.5 ${item.done ? "text-green-500" : "text-red-400"}`}>
                            {item.done ? "\u2713" : "\u25CB"}
                          </span>
                          <span className={item.done ? "text-gray-400 line-through" : "text-gray-700 dark:text-gray-300"}>
                            {item.assignee && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                {item.assignee}
                              </span>
                            )}{" "}
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No action items this week.</p>
          )}
        </div>
      )}

      {/* 3a. Weekly Retro Summary — grouped by Weekly Goal */}
      {project && project.items.length > 0 && (
        <div className="rounded-lg bg-white shadow-sm dark:bg-gray-900">
          <button
            onClick={() => setRetroExpanded(!retroExpanded)}
            className="flex w-full items-center justify-between p-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Weekly Retro: {project.sprint}
            </h2>
            <span className="text-sm text-gray-500">
              {retroExpanded ? "접기" : "펼치기"}
            </span>
          </button>
          {retroExpanded && (
            <div className="space-y-4 px-4 pb-4">
              {Object.entries(project.byWeeklyGoal ?? {}).length > 0 ? (
                Object.entries(project.byWeeklyGoal ?? {}).map(([goalName, goalItems]) => {
                  const merged = goalItems.filter((i) => i.merged).length;
                  const total = goalItems.length;
                  return (
                    <div key={goalName} className="rounded-lg border border-gray-200 dark:border-gray-700">
                      {/* Weekly Goal header */}
                      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {goalName}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            {merged}/{total} merged
                          </span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${total > 0 ? (merged / total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      {/* PR table */}
                      <RetroTable items={goalItems} dn={dn} />
                    </div>
                  );
                })
              ) : (
                /* Fallback: group by monthly goal as table */
                Object.entries(project.byGoal).map(([goal, goalItems]) => {
                  const merged = goalItems.filter((i) => i.merged).length;
                  return (
                    <div key={goal} className="rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {goal}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            {merged}/{goalItems.length} merged
                          </span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${goalItems.length > 0 ? (merged / goalItems.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <RetroTable items={goalItems} dn={dn} />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* 3b. Goal Health */}
      {project && project.goalProgress.length > 0 && (
        <div className="rounded-lg bg-white shadow-sm dark:bg-gray-900">
          <button
            onClick={() => setGoalHealthExpanded(!goalHealthExpanded)}
            className="flex w-full items-center justify-between p-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Goal Health
            </h2>
            <span className="text-sm text-gray-500">
              {goalHealthExpanded ? "접기" : "펼치기"}
            </span>
          </button>
          {goalHealthExpanded && (
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
              {project.goalProgress.map((goal) => {
                const prev = previousGoalMap.get(goal.goalName);
                const mergedDelta = prev ? goal.mergedCount - prev.mergedCount : null;
                const inReviewDelta = prev ? goal.inReviewCount - prev.inReviewCount : null;
                return (
                  <div key={goal.goalName} className="rounded border border-gray-200 p-3 dark:border-gray-700">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {goal.goalName}
                      </h3>
                      <span className="text-sm font-bold text-blue-600">{goal.progressPercent}%</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${goal.progressPercent}%` }}
                      />
                    </div>
                    {/* Status distribution */}
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span className="text-green-600">
                        {goal.mergedCount} merged
                        {mergedDelta !== null && mergedDelta !== 0 && (
                          <span className={mergedDelta > 0 ? "ml-1 text-green-500" : "ml-1 text-red-500"}>
                            {mergedDelta > 0 ? `+${mergedDelta}` : mergedDelta}
                          </span>
                        )}
                      </span>
                      <span className="text-blue-600">
                        {goal.inReviewCount} in review
                        {inReviewDelta !== null && inReviewDelta !== 0 && (
                          <span className={inReviewDelta > 0 ? "ml-1 text-blue-500" : "ml-1 text-red-500"}>
                            {inReviewDelta > 0 ? `+${inReviewDelta}` : inReviewDelta}
                          </span>
                        )}
                      </span>
                      <span>{goal.draftCount} draft</span>
                      {goal.closedCount > 0 && <span className="text-red-500">{goal.closedCount} closed</span>}
                    </div>
                    {/* Assignees */}
                    {goal.assignees.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {goal.assignees.map((a) => (
                          <span key={a} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {dn(a)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3c. Individual Summary */}
      {project && Object.keys(project.byAssignee).length > 0 && (
        <div className="rounded-lg bg-white shadow-sm dark:bg-gray-900">
          <button
            onClick={() => setIndividualExpanded(!individualExpanded)}
            className="flex w-full items-center justify-between p-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Individual Summary
            </h2>
            <span className="text-sm text-gray-500">
              {individualExpanded ? "접기" : "펼치기"}
            </span>
          </button>
          {individualExpanded && (
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
              {Object.entries(project.byAssignee).map(([assignee, items]) => {
                const merged = items.filter((i) => i.merged).length;
                const inReview = items.filter((i) => i.status === "In Review").length;
                const draft = items.filter((i) => i.status === "Draft").length;
                // Group by goal
                const goalGroups = new Map<string, number>();
                for (const item of items) {
                  const g = item.monthlyGoal ?? "Ungrouped";
                  goalGroups.set(g, (goalGroups.get(g) ?? 0) + 1);
                }
                return (
                  <div key={assignee} className="rounded border border-gray-200 p-3 dark:border-gray-700">
                    <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                      {dn(assignee)}
                    </h3>
                    <div className="mb-2 flex gap-3 text-xs">
                      <span className="text-green-600">{merged} merged</span>
                      <span className="text-blue-600">{inReview} in review</span>
                      <span className="text-gray-500">{draft} draft</span>
                    </div>
                    <div className="space-y-1">
                      {[...goalGroups.entries()].map(([goal, count]) => (
                        <div key={goal} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">{goal}</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">{count} items</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Chart: PR Activity by Repo */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          PR Activity by Repo
        </h2>
        <PRActivityChart repos={github.repos} />
      </div>

      {/* Context Sync: sessions with PR mentions and action items */}
      {contextSync.notes.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Context Sync Sessions
          </h2>
          <div className="space-y-3">
            {contextSync.notes.map((note) => {
              const allText = [
                note.title,
                ...note.topics,
                ...note.keyInsights,
                ...note.actionItems.map((a) => a.text),
              ].join(" ");
              const prMentions = [...allText.matchAll(/(\w[\w-]*)#(\d+)/g)].map(
                (m) => `${m[1]}#${m[2]}`
              );

              return (
                <div
                  key={note.id}
                  className="rounded border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {note.title || note.date}
                    </span>
                    <span className="text-sm text-gray-500">{note.date}</span>
                  </div>
                  {note.topics.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {note.topics.map((topic, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                  {prMentions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {[...new Set(prMentions)].map((ref) => (
                        <span
                          key={ref}
                          className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                  )}
                  {note.keyInsights.length > 0 && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {note.keyInsights[0]}
                    </p>
                  )}
                  {note.actionItems.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {note.actionItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-sm">
                          <span className={item.done ? "text-green-500" : "text-gray-400"}>
                            {item.done ? "\u2713" : "\u25CB"}
                          </span>
                          <span className={item.done ? "text-gray-400 line-through" : "text-gray-700 dark:text-gray-300"}>
                            {item.assignee && (
                              <span className="font-medium">{item.assignee}: </span>
                            )}
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collected timestamp */}
      <p className="text-center text-xs text-gray-400">
        Last collected: {new Date(current.collectedAt).toLocaleString("ko-KR")}
      </p>
    </>
  );
}

/** PR Queue table used by both Review Queue and Draft Queue. */
function PRQueueTable({
  prs,
  staleColorFn,
  dn,
}: {
  prs: (PRInfo & { bizDays: number })[];
  staleColorFn: (bizDays: number) => string;
  dn: (name: string) => string;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700">
          <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">PR</th>
          <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Author</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">Age (biz days)</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">Reviewers</th>
        </tr>
      </thead>
      <tbody>
        {prs.map((pr) => (
          <tr key={`${pr.repo}-${pr.number}`} className="border-b border-gray-100 dark:border-gray-800">
            <td className="px-2 py-1">
              <a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {pr.repo}#{pr.number}
              </a>
              <span className="ml-2 text-gray-500">
                {pr.title.slice(0, 40)}{pr.title.length > 40 ? "..." : ""}
              </span>
            </td>
            <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{dn(pr.author)}</td>
            <td className={`px-2 py-1 text-right font-medium ${staleColorFn(pr.bizDays)}`}>
              {pr.bizDays}d
            </td>
            <td className="px-2 py-1">
              {pr.reviewers.length > 0 ? (
                <div className="flex flex-wrap justify-end gap-1">
                  {pr.reviewers.map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    >
                      {dn(r)}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="block text-right text-gray-400">&mdash;</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Retro PR table: status, linkable title with repo chip, author. */
function RetroTable({ items, dn }: { items: ProjectItem[]; dn: (name: string) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/30">
            <th className="w-24 px-4 py-1.5 text-left text-xs font-medium text-gray-500">Status</th>
            <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500">Title</th>
            <th className="w-32 px-4 py-1.5 text-left text-xs font-medium text-gray-500">Author</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-50 last:border-b-0 dark:border-gray-800/50">
              <td className="px-4 py-1.5">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-1.5">
                <div className="flex items-center gap-2">
                  {item.repo && (
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {item.repo}
                    </span>
                  )}
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="truncate text-gray-900 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400">
                      {item.title}
                    </a>
                  ) : (
                    <span className="truncate text-gray-700 dark:text-gray-300">{item.title}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-1.5 text-gray-500">
                {item.assignees.length > 0 ? item.assignees.map(dn).join(", ") : dn(item.author ?? "")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Retro goal section: group items by assignee within a goal. */
function RetroGoalSection({ items, dn }: { items: ProjectItem[]; dn: (name: string) => string }) {
  const byAssignee = new Map<string, ProjectItem[]>();
  for (const item of items) {
    const assignees = item.assignees.length > 0 ? item.assignees : [item.author ?? "unassigned"];
    for (const a of assignees) {
      if (!byAssignee.has(a)) byAssignee.set(a, []);
      byAssignee.get(a)!.push(item);
    }
  }

  return (
    <div className="space-y-2">
      {[...byAssignee.entries()].map(([assignee, assigneeItems]) => (
        <div key={assignee} className="ml-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{dn(assignee)}:</p>
          <div className="ml-4 space-y-0.5">
            {assigneeItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <StatusBadge status={item.status} />
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {item.repo ? `${item.repo}#${item.number}` : "link"}
                  </a>
                ) : null}
                <span className="text-gray-600 dark:text-gray-400">
                  &ldquo;{item.title.slice(0, 50)}{item.title.length > 50 ? "..." : ""}&rdquo;
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
