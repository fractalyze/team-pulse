// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { PRTrendChart, KnowledgeTrendChart } from "@/components/charts/trend-line";
import type { WeeklySnapshot } from "@/lib/types";

interface TrendsContentProps {
  snapshots: WeeklySnapshot[];
}

export function TrendsContent({ snapshots }: TrendsContentProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          PR Velocity
        </h2>
        <PRTrendChart snapshots={snapshots} />
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Knowledge Growth
        </h2>
        <KnowledgeTrendChart snapshots={snapshots} />
      </div>

      {/* Mission alignment over time */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Mission Alignment Over Time
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">
                  Week
                </th>
                {(() => {
                  const allObjectives = new Set<string>();
                  snapshots.forEach((s) =>
                    Object.keys(s.github.byObjective).forEach((o) =>
                      allObjectives.add(o)
                    )
                  );
                  return [...allObjectives].map((obj) => (
                    <th
                      key={obj}
                      className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400"
                    >
                      {obj.replace("OBJ1: ", "")}
                    </th>
                  ));
                })()}
                <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => {
                const allObjectives = new Set<string>();
                snapshots.forEach((ss) =>
                  Object.keys(ss.github.byObjective).forEach((o) =>
                    allObjectives.add(o)
                  )
                );
                return (
                  <tr
                    key={s.weekId}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-2 py-1 font-mono text-gray-900 dark:text-white">
                      {s.weekId.replace(/^\d{4}-/, "")}
                    </td>
                    {[...allObjectives].map((obj) => (
                      <td
                        key={obj}
                        className="px-2 py-1 text-right text-gray-700 dark:text-gray-300"
                      >
                        {s.github.byObjective[obj] ?? 0}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right font-medium text-gray-900 dark:text-white">
                      {s.github.totalMerged}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context Sync participation */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Context Sync Participation
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">
                  Week
                </th>
                <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">
                  Sessions
                </th>
                <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">
                  Topics
                </th>
                <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">
                  Action Items
                </th>
                <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-400">
                  Pending
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr
                  key={s.weekId}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className="px-2 py-1 font-mono text-gray-900 dark:text-white">
                    {s.weekId.replace(/^\d{4}-/, "")}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-700 dark:text-gray-300">
                    {s.contextSync.totalSessions}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-700 dark:text-gray-300">
                    {s.contextSync.totalTopics}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-700 dark:text-gray-300">
                    {s.contextSync.totalActionItems}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-700 dark:text-gray-300">
                    {s.contextSync.pendingActionItems}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
