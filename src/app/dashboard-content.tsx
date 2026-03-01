// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useState } from "react";
import { MetricCard } from "@/components/charts/metric-card";
import { PRActivityChart } from "@/components/charts/pr-activity";
import type { DashboardSummary } from "@/lib/types";

interface DashboardContentProps {
  summary: DashboardSummary;
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

export function DashboardContent({ summary }: DashboardContentProps) {
  const { current, delta } = summary;
  const { github, knowledge, contextSync } = current;
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

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
  const openPRs = github.repos
    .flatMap((r) => r.open)
    .map((pr) => {
      const daysOpen = Math.floor(
        (Date.now() - new Date(pr.createdAt).getTime()) / 86400000
      );
      return { ...pr, daysOpen };
    })
    .sort((a, b) => b.daysOpen - a.daysOpen);

  // Unreviewed merged PRs (based on actual review API data)
  const unreviewedKeys = new Set(github.reviewHealth.unreviewedPRKeys ?? []);
  const unreviewedPRs = allMergedPRs.filter(
    (pr) => unreviewedKeys.has(`${pr.repo}#${pr.number}`)
  );

  // Review health: per-reviewer breakdown
  const reviewerEntries = Object.entries(github.reviewHealth.byReviewer)
    .sort((a, b) => b[1] - a[1]);

  const toggle = (card: string) =>
    setExpandedCard(expandedCard === card ? null : card);

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
            title="PRs Open"
            value={github.totalOpen}
            delta={delta?.prsOpenDelta}
            subtitle={
              github.avgLeadTimeDays !== null
                ? `avg ${github.avgLeadTimeDays}d lead time`
                : undefined
            }
            color="yellow"
          />
        </div>
        <MetricCard
          title="Action Items"
          value={`${doneActions}/${totalActions}`}
          subtitle={`${contextSync.totalSessions} sync sessions`}
          color={actionItemsColor(doneActions, totalActions)}
        />
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
                    <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{pr.author}</td>
                    <td className="px-2 py-1">
                      {pr.reviewers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {pr.reviewers.map((r) => (
                            <span
                              key={r}
                              className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-500">
                      {pr.leadTimeDays !== null ? `${pr.leadTimeDays}d` : "—"}
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
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{author}</td>
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
          {/* Missed reviews table: PR → who didn't review */}
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
                                {r}
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
          {/* Per-reviewer table */}
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
                    <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{reviewer}</td>
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
                    <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{pr.author}</td>
                    <td className="px-2 py-1">
                      {pr.reviewers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {pr.reviewers.map((r) => (
                            <span
                              key={r}
                              className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
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

      {/* Expanded: Open PRs (Review Queue) */}
      {expandedCard === "open" && openPRs.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Review Queue ({openPRs.length} open)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">PR</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">Author</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">Age</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">Reviewers</th>
                </tr>
              </thead>
              <tbody>
                {openPRs.map((pr) => {
                  const ageColor =
                    pr.daysOpen >= 5
                      ? "text-red-600"
                      : pr.daysOpen >= 3
                        ? "text-yellow-600"
                        : "text-gray-700 dark:text-gray-300";
                  return (
                    <tr key={`${pr.repo}-${pr.number}`} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-2 py-1">
                        <a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {pr.repo}#{pr.number}
                        </a>
                        <span className="ml-2 text-gray-500">
                          {pr.title.slice(0, 40)}{pr.title.length > 40 ? "..." : ""}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{pr.author}</td>
                      <td className={`px-2 py-1 text-right font-medium ${ageColor}`}>{pr.daysOpen}d</td>
                      <td className="px-2 py-1">
                        {pr.reviewers.length > 0 ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            {pr.reviewers.map((r) => (
                              <span
                                key={r}
                                className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="block text-right text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
                            {item.done ? "✓" : "○"}
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
