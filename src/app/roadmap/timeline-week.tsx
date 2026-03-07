// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import type { GoalStatus, RoadmapWeek } from "@/lib/types";

const BG_BY_STATUS: Record<GoalStatus, string> = {
  done: "bg-green-500",
  in_progress: "bg-blue-500",
  not_started: "bg-gray-400",
};

interface TimelineWeekProps {
  week: RoadmapWeek;
  onClick: () => void;
}

export function TimelineWeek({ week, onClick }: TimelineWeekProps) {
  // Collect unique assignee initials with their worst status
  const assigneeStatus = new Map<string, GoalStatus>();
  for (const task of week.tasks) {
    const initial = task.assignee.charAt(0).toUpperCase();
    const current = assigneeStatus.get(initial);
    if (!current || statusPriority(task.status) > statusPriority(current)) {
      assigneeStatus.set(initial, task.status);
    }
  }

  const rateLabel =
    week.achievementRate >= 0 ? `${week.achievementRate}%` : "-";

  return (
    <button
      onClick={onClick}
      className={`flex min-w-[5rem] flex-col items-center rounded-lg border p-2 text-center transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
        week.isCurrent
          ? "border-blue-500 ring-2 ring-blue-500"
          : "border-gray-200 dark:border-gray-700"
      } ${week.tasks.length === 0 ? "opacity-50" : ""}`}
      title={week.weekLabel}
    >
      {/* Week label */}
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {week.weekId.split("-")[1]}
        {week.isCurrent && (
          <span className="ml-0.5 text-blue-500">★</span>
        )}
      </span>

      {/* Mini progress */}
      <span
        className={`mt-1 text-lg font-bold ${
          week.achievementRate === 100
            ? "text-green-500"
            : week.achievementRate >= 0
              ? "text-gray-900 dark:text-white"
              : "text-gray-400"
        }`}
      >
        {rateLabel}
      </span>

      {/* Assignee initials */}
      <div className="mt-1 flex gap-0.5">
        {week.blockingCount > 0 && (
          <span className="text-xs font-bold text-red-500" title="Blocking tasks">
            !
          </span>
        )}
        {[...assigneeStatus.entries()].map(([initial, status]) => (
          <span
            key={initial}
            className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${BG_BY_STATUS[status]}`}
          >
            {initial}
          </span>
        ))}
      </div>
    </button>
  );
}

function statusPriority(status: GoalStatus): number {
  switch (status) {
    case "not_started":
      return 2;
    case "in_progress":
      return 1;
    case "done":
      return 0;
  }
}
