// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useState, useMemo } from "react";

import type {
  CrossRepoMilestone,
  MilestonePRRef,
  RepoMilestoneDetail,
} from "@/lib/types";
import { UNASSIGNED_TITLE } from "@/lib/generators/metrics";

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

const DRAFT_COLOR = "text-gray-400";

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

interface AuthorPRGroup {
  author: string;
  prs: (MilestonePRRef & { repo: string })[];
}

function groupPRsByAuthor(repos: RepoMilestoneDetail[]): AuthorPRGroup[] {
  const map = new Map<string, (MilestonePRRef & { repo: string })[]>();
  for (const rd of repos) {
    for (const pr of rd.prs) {
      const key = pr.author;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ ...pr, repo: rd.repo });
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([author, prs]) => ({ author, prs }));
}

function MilestoneRow({
  ms,
  expanded,
  onToggle,
}: {
  ms: CrossRepoMilestone;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isUnassigned = ms.title === UNASSIGNED_TITLE;
  const total = ms.mergedCount + ms.openCount + ms.draftCount;
  const pct = total > 0 ? Math.round((ms.mergedCount / total) * 100) : 0;
  const dueStatus = getDueStatus(ms.dueOn);
  const authorGroups = useMemo(() => groupPRsByAuthor(ms.repos), [ms.repos]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Collapsed row — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        <span
          className={`shrink-0 text-xs text-gray-400 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        >
          ▶
        </span>

        <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">
          {isUnassigned ? "Unassigned PRs" : ms.title}
        </span>

        <div className="flex shrink-0 items-center gap-3">
          {isUnassigned ? (
            <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300">
              {ms.mergedCount} merged · {ms.openCount} open{ms.draftCount > 0 ? ` · ${ms.draftCount} draft` : ""}
            </span>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300">
                  {ms.mergedCount}/{total}{ms.draftCount > 0 ? ` (${ms.draftCount} draft)` : ""}
                </span>
              </div>

              {ms.dueOn && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${DUE_BADGE_STYLE[dueStatus]}`}
                >
                  Due {ms.dueOn}
                </span>
              )}
            </>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          {ms.description && (
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              {ms.description}
            </p>
          )}

          {authorGroups.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No PRs assigned to this milestone.
            </p>
          ) : (
            <div className="space-y-2">
              {authorGroups.map(({ author, prs }) => (
                <div key={author} className="flex items-start gap-2">
                  <span className="mt-0.5 w-28 shrink-0 truncate text-xs font-medium text-gray-500 dark:text-gray-400">
                    {author}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {prs.map((pr) => (
                      <div
                        key={`${pr.repo}#${pr.number}`}
                        className="flex items-center gap-1.5 text-sm"
                      >
                        <span className={`shrink-0 ${pr.draft ? DRAFT_COLOR : STATE_COLOR[pr.state]}`}>
                          {STATE_ICON[pr.state]}
                        </span>
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-gray-700 hover:underline dark:text-gray-300"
                        >
                          #{pr.number}
                        </a>
                        <span className="min-w-0 truncate text-gray-500 dark:text-gray-400">
                          {pr.title}
                        </span>
                        {pr.draft && (
                          <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                            Draft
                          </span>
                        )}
                        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          {pr.repo}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CrossRepoMilestones({ milestones }: CrossRepoMilestonesProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const assigned = useMemo(
    () => milestones.filter((ms) => ms.title !== UNASSIGNED_TITLE),
    [milestones],
  );
  const unassigned = useMemo(
    () => milestones.find((ms) => ms.title === UNASSIGNED_TITLE),
    [milestones],
  );

  if (assigned.length === 0 && !unassigned) return null;

  function toggle(title: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Team Milestones
      </h2>
      <div className="space-y-2">
        {assigned.map((ms) => (
          <MilestoneRow
            key={ms.title}
            ms={ms}
            expanded={expanded.has(ms.title)}
            onToggle={() => toggle(ms.title)}
          />
        ))}
        {unassigned && (
          <MilestoneRow
            ms={unassigned}
            expanded={expanded.has(UNASSIGNED_TITLE)}
            onToggle={() => toggle(UNASSIGNED_TITLE)}
          />
        )}
      </div>
    </div>
  );
}
