// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import type { CrossRepoMilestone, MilestonePRRef } from "@/lib/types";

interface CrossRepoMilestonesProps {
  milestones: CrossRepoMilestone[];
}

const STATE_ICON: Record<MilestonePRRef["state"], string> = {
  merged: "\u2713",
  open: "\u25D0",
  closed: "\u2717",
};

const STATE_COLOR: Record<MilestonePRRef["state"], string> = {
  merged: "text-green-500",
  open: "text-blue-500",
  closed: "text-gray-400",
};

function getDueStatus(dueOn: string | null): "normal" | "soon" | "overdue" {
  if (!dueOn) return "normal";
  const now = new Date();
  const due = new Date(dueOn + "T23:59:59");
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "soon";
  return "normal";
}

const DUE_BADGE_STYLE: Record<ReturnType<typeof getDueStatus>, string> = {
  normal: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  soon: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

export function CrossRepoMilestones({ milestones }: CrossRepoMilestonesProps) {
  if (milestones.length === 0) return null;

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Cross-Repo Milestones
      </h2>
      <div className="space-y-4">
        {milestones.map((ms) => {
          const total = ms.mergedCount + ms.openCount;
          const pct = total > 0 ? Math.round((ms.mergedCount / total) * 100) : 0;
          const dueStatus = getDueStatus(ms.dueOn);

          return (
            <div
              key={ms.title}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            >
              {/* Header: title + due date */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {ms.title}
                </h3>
                {ms.dueOn && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${DUE_BADGE_STYLE[dueStatus]}`}
                  >
                    Due {ms.dueOn}
                  </span>
                )}
              </div>

              {/* Description */}
              {ms.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {ms.description}
                </p>
              )}

              {/* Progress bar */}
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="shrink-0 text-sm text-gray-600 dark:text-gray-300">
                  {ms.mergedCount}/{total} merged ({pct}%)
                </span>
              </div>

              {/* Repos + PRs */}
              {ms.repos.length > 0 && (
                <div className="mt-3 space-y-2">
                  {ms.repos.map((rd) => (
                    <div key={rd.repo} className="flex items-start gap-2">
                      <span className="mt-0.5 w-24 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
                        {rd.repo}
                      </span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {rd.prs.map((pr) => (
                          <a
                            key={`${rd.repo}#${pr.number}`}
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm hover:underline"
                            title={pr.title}
                          >
                            <span className={STATE_COLOR[pr.state]}>
                              {STATE_ICON[pr.state]}
                            </span>
                            <span className="text-gray-700 dark:text-gray-300">
                              #{pr.number}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
