// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { MetricCard } from "@/components/charts/metric-card";
import { PRActivityChart } from "@/components/charts/pr-activity";
import { KnowledgeDonut } from "@/components/charts/knowledge-donut";
import type { DashboardSummary } from "@/lib/types";

interface DashboardContentProps {
  summary: DashboardSummary;
}

export function DashboardContent({ summary }: DashboardContentProps) {
  const { current, delta } = summary;
  const { github, knowledge, contextSync } = current;

  const repoCount = github.repos.filter((r) => r.totalMerged > 0).length;

  return (
    <>
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          title="PRs Merged"
          value={github.totalMerged}
          delta={delta?.prsMergedDelta}
          subtitle={`across ${repoCount} repos`}
          color="green"
        />
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
        <MetricCard
          title="Knowledge Created"
          value={knowledge.totalCreated}
          delta={delta?.knowledgeCreatedDelta}
          subtitle={`${knowledge.totalUpdated} updated`}
          color="blue"
        />
        <MetricCard
          title="Context Sync"
          value={contextSync.totalSessions}
          delta={delta?.contextSyncSessionsDelta}
          subtitle={`${contextSync.totalTopics} topics`}
          color="purple"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            PR Activity by Repo
          </h2>
          <PRActivityChart repos={github.repos} />
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Knowledge by Category
          </h2>
          <KnowledgeDonut knowledge={knowledge} />
        </div>
      </div>

      {/* Mission Alignment */}
      {Object.keys(github.byObjective).length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Mission Alignment
          </h2>
          <div className="space-y-2">
            {Object.entries(github.byObjective)
              .sort((a, b) => b[1] - a[1])
              .map(([objective, count]) => {
                const maxCount = Math.max(
                  ...Object.values(github.byObjective)
                );
                const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={objective} className="flex items-center gap-3">
                    <span className="w-48 shrink-0 text-sm text-gray-600 dark:text-gray-400">
                      {objective}
                    </span>
                    <div className="flex-1">
                      <div className="h-6 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                        <div
                          className="flex h-full items-center rounded bg-blue-500 px-2 text-xs text-white"
                          style={{ width: `${Math.max(width, 8)}%` }}
                        >
                          {count}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Context Sync Summary */}
      {contextSync.notes.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Context Sync Sessions
          </h2>
          <div className="space-y-3">
            {contextSync.notes.map((note) => (
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
                {note.keyInsights.length > 0 && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {note.keyInsights[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Updates */}
      {(knowledge.newEntries.length > 0 ||
        knowledge.updatedEntries.length > 0) && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Knowledge Graph Updates
          </h2>
          <div className="space-y-2">
            {knowledge.newEntries.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2 text-sm">
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                  NEW
                </span>
                <span className="font-mono text-gray-900 dark:text-white">
                  {entry.name}
                </span>
                <span className="text-gray-500">{entry.category}</span>
                {entry.linkedPR && (
                  <span className="text-gray-400">{entry.linkedPR}</span>
                )}
              </div>
            ))}
            {knowledge.updatedEntries.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2 text-sm">
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  UPD
                </span>
                <span className="font-mono text-gray-900 dark:text-white">
                  {entry.name}
                </span>
                <span className="text-gray-500">{entry.category}</span>
                {entry.linkedPR && (
                  <span className="text-gray-400">{entry.linkedPR}</span>
                )}
              </div>
            ))}
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
