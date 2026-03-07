// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import type { GoalStatus, RoadmapMonth } from "@/lib/types";
import { TimelineGantt } from "./timeline-gantt";

const STATUS_ICON: Record<GoalStatus, string> = {
  done: "\u2713",
  in_progress: "\u25D0",
  not_started: "\u25CB",
};

const CHIP_STYLE: Record<GoalStatus, string> = {
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  not_started:
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

interface TimelineMonthProps {
  month: RoadmapMonth;
  onGoalStatusChange: (
    month: string,
    goalId: string,
    currentStatus: GoalStatus
  ) => void;
}

export function TimelineMonth({
  month,
  onGoalStatusChange,
}: TimelineMonthProps) {
  return (
    <div
      className={`rounded-lg bg-white shadow-sm dark:bg-gray-900 ${
        month.isCurrent ? "ring-2 ring-blue-500" : ""
      }`}
    >
      {/* Month header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-white">
            {month.label}
          </span>
          {month.isCurrent && (
            <span className="text-blue-500" title="Current month">
              ★
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{month.progressRate}%</span>
          {month.isAtRisk && (
            <span
              className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              title="At risk: blocking tasks or behind schedule"
            >
              AT RISK
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={`h-full rounded-full transition-all ${
            month.isAtRisk
              ? "bg-amber-500"
              : "bg-gradient-to-r from-blue-500 to-purple-500"
          }`}
          style={{ width: `${month.progressRate}%` }}
        />
      </div>

      {/* Monthly goal chips */}
      {month.goals.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {month.goals.map((goal) => (
            <button
              key={goal.id}
              onClick={() =>
                onGoalStatusChange(month.month, goal.id, goal.status)
              }
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 ${CHIP_STYLE[goal.status]}`}
              title={`Click to cycle status (${goal.status})`}
            >
              <span>{STATUS_ICON[goal.status]}</span>
              <span>{goal.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Gantt timeline */}
      <TimelineGantt month={month} />
    </div>
  );
}
