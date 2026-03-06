// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useState } from "react";
import type {
  GoalStatus,
  HalfYearObjective,
  MonthlyGoal,
  WeeklyTask,
} from "@/lib/types";

interface GoalProgressProps {
  halfYear: HalfYearObjective | null;
  monthlyGoals: MonthlyGoal[];
  weeklyTasks: WeeklyTask[];
  month: string;
  allMonthlyDone: number;
  allMonthlyTotal: number;
}

const STATUS_ICON: Record<GoalStatus, string> = {
  done: "\u2713",
  in_progress: "\u25D0",
  not_started: "\u25CB",
};

const STATUS_LABEL: Record<GoalStatus, string> = {
  done: "done",
  in_progress: "in progress",
  not_started: "not started",
};

const BORDER_COLOR: Record<GoalStatus, string> = {
  done: "border-l-green-500",
  in_progress: "border-l-blue-500",
  not_started: "border-l-gray-400",
};

const ICON_COLOR: Record<GoalStatus, string> = {
  done: "text-green-500",
  in_progress: "text-blue-500",
  not_started: "text-gray-400",
};

export function GoalProgress({
  halfYear,
  monthlyGoals,
  weeklyTasks,
  month,
  allMonthlyDone,
  allMonthlyTotal,
}: GoalProgressProps) {
  const [collapsed, setCollapsed] = useState(false);

  const weekDone = weeklyTasks.filter((t) => t.status === "done").length;
  const weekTotal = weeklyTasks.length;
  const monthDone = monthlyGoals.filter((g) => g.status === "done").length;

  const halfPct =
    allMonthlyTotal > 0
      ? Math.round((allMonthlyDone / allMonthlyTotal) * 100)
      : 0;

  // Group weekly tasks by assignee
  const byAssignee = new Map<string, WeeklyTask[]>();
  for (const task of weeklyTasks) {
    if (!byAssignee.has(task.assignee)) {
      byAssignee.set(task.assignee, []);
    }
    byAssignee.get(task.assignee)!.push(task);
  }

  const monthLabel = month
    ? `${parseInt(month.split("-")[1], 10)}월`
    : "";

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full rounded-lg bg-white p-3 text-left shadow-sm dark:bg-gray-900"
      >
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-white">
            {halfYear
              ? `${halfYear.period}: ${halfYear.title}`
              : "Goals"}
          </span>
          <span className="text-gray-500">
            {monthLabel} {monthDone}/{monthlyGoals.length} | Week{" "}
            {weekDone}/{weekTotal}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-lg bg-white shadow-sm dark:bg-gray-900">
      {/* Header with collapse button */}
      <button
        onClick={() => setCollapsed(true)}
        className="w-full border-b border-gray-100 px-4 py-2 text-right text-xs text-gray-400 hover:text-gray-600 dark:border-gray-800"
      >
        Collapse
      </button>

      {/* Half-year progress */}
      {halfYear && (
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900 dark:text-white">
              {halfYear.period}: {halfYear.title}
            </span>
            <span className="text-sm text-gray-500">
              {allMonthlyDone}/{allMonthlyTotal} ({halfPct}%)
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
              style={{ width: `${halfPct}%` }}
            />
          </div>
          {halfYear.description && (
            <p className="mt-1 text-xs text-gray-500">{halfYear.description}</p>
          )}
        </div>
      )}

      {/* Monthly goals */}
      {monthlyGoals.length > 0 && (
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {monthLabel} Goals
            </span>
            <span className="text-xs text-gray-500">
              {monthDone}/{monthlyGoals.length} done
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {monthlyGoals.map((goal) => (
              <div
                key={goal.id}
                className={`rounded border-l-4 bg-gray-50 px-3 py-2 dark:bg-gray-800 ${BORDER_COLOR[goal.status]}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`${ICON_COLOR[goal.status]}`}>
                    {STATUS_ICON[goal.status]}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {goal.title}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {STATUS_LABEL[goal.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly tasks by assignee */}
      {weeklyTasks.length > 0 && (
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Weekly Tasks
            </span>
            <span className="text-xs text-gray-500">
              Team: {weekDone}/{weekTotal}{" "}
              {weekTotal > 0
                ? `${Math.round((weekDone / weekTotal) * 100)}%`
                : ""}
            </span>
          </div>
          <div className="space-y-1.5">
            {[...byAssignee.entries()].map(([assignee, memberTasks]) => (
              <div key={assignee} className="flex items-start gap-2">
                <span className="w-20 shrink-0 text-sm font-medium text-gray-900 dark:text-white">
                  {assignee}
                </span>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {memberTasks.map((task) => (
                    <span
                      key={task.id}
                      className="flex items-center gap-1 text-sm"
                    >
                      <span className={ICON_COLOR[task.status]}>
                        {STATUS_ICON[task.status]}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {task.content}
                      </span>
                      {task.deadline && (
                        <span className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-500 dark:bg-gray-800">
                          {task.deadline.slice(5)}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!halfYear && monthlyGoals.length === 0 && weeklyTasks.length === 0 && (
        <div className="px-4 py-3 text-center text-sm text-gray-400">
          No goals set. Add them in Admin.
        </div>
      )}
    </div>
  );
}
