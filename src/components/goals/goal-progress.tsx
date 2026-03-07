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

const CHIP_BG: Record<GoalStatus, string> = {
  done: "bg-green-50 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  in_progress:
    "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  not_started:
    "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400",
};

const ICON_COLOR: Record<GoalStatus, string> = {
  done: "text-green-500",
  in_progress: "text-blue-500",
  not_started: "text-gray-400",
};

const PROGRESS_RING_SIZE = 80;
const PROGRESS_RING_STROKE = 6;
const PROGRESS_RING_RADIUS = (PROGRESS_RING_SIZE - PROGRESS_RING_STROKE) / 2;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;

function ProgressRing({ percent }: { percent: number }) {
  const offset =
    PROGRESS_RING_CIRCUMFERENCE - (percent / 100) * PROGRESS_RING_CIRCUMFERENCE;

  return (
    <div className="relative">
      <svg
        width={PROGRESS_RING_SIZE}
        height={PROGRESS_RING_SIZE}
        className="-rotate-90"
      >
        <circle
          cx={PROGRESS_RING_SIZE / 2}
          cy={PROGRESS_RING_SIZE / 2}
          r={PROGRESS_RING_RADIUS}
          fill="none"
          className="stroke-gray-200 dark:stroke-gray-700"
          strokeWidth={PROGRESS_RING_STROKE}
        />
        <circle
          cx={PROGRESS_RING_SIZE / 2}
          cy={PROGRESS_RING_SIZE / 2}
          r={PROGRESS_RING_RADIUS}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={PROGRESS_RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={PROGRESS_RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900 dark:text-white">
        {percent}%
      </span>
    </div>
  );
}

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
  const weekPct =
    weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

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

  // Empty state
  if (!halfYear && monthlyGoals.length === 0 && weeklyTasks.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-lg dark:bg-gray-900">
        <p className="text-sm text-gray-400">
          No goals set. Add them in Admin.
        </p>
      </div>
    );
  }

  // Collapsed
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full rounded-xl bg-white px-5 py-3 text-left shadow-lg transition-shadow hover:shadow-xl dark:bg-gray-900"
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-900 dark:text-white">
            {halfYear
              ? `${halfYear.period}: ${halfYear.title}`
              : "Goals"}
          </span>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              {monthLabel} {monthDone}/{monthlyGoals.length}
            </span>
            <span>
              Week {weekDone}/{weekTotal}
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {halfPct}%
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-lg dark:bg-gray-900">
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(true)}
        className="w-full px-5 py-1.5 text-right text-xs text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
      >
        Collapse
      </button>

      {/* Hero header */}
      <div className="px-6 pb-5">
        {halfYear ? (
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-blue-500">
                {halfYear.period}
              </p>
              <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                {halfYear.title}
              </h2>
              {halfYear.description && (
                <p className="mt-1 text-sm text-gray-500">
                  {halfYear.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                <span>
                  {allMonthlyDone}/{allMonthlyTotal} goals done
                </span>
                <span>|</span>
                <span>
                  Week {weekDone}/{weekTotal} ({weekPct}%)
                </span>
              </div>
            </div>
            <ProgressRing percent={halfPct} />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Goals
            </h2>
            <div className="text-sm text-gray-500">
              Week {weekDone}/{weekTotal}
            </div>
          </div>
        )}

        {/* Full-width progress bar */}
        {allMonthlyTotal > 0 && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-700"
              style={{ width: `${halfPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Monthly goals */}
      {monthlyGoals.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {monthLabel} Goals
            </span>
            <span className="text-xs text-gray-400">
              {monthDone}/{monthlyGoals.length} done
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {monthlyGoals.map((goal) => (
              <div
                key={goal.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${CHIP_BG[goal.status]}`}
              >
                <span>{STATUS_ICON[goal.status]}</span>
                <span>{goal.title}</span>
                <span className="ml-0.5 text-xs opacity-60">
                  {STATUS_LABEL[goal.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly tasks by assignee */}
      {weeklyTasks.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Weekly Tasks
            </span>
            <span className="text-xs text-gray-400">
              {weekDone}/{weekTotal}{" "}
              {weekPct > 0 && `${weekPct}%`}
            </span>
          </div>
          <div className="space-y-2">
            {[...byAssignee.entries()].map(([assignee, memberTasks]) => {
              const memberDone = memberTasks.filter(
                (t) => t.status === "done"
              ).length;
              return (
                <div key={assignee} className="flex items-start gap-3">
                  <div className="flex w-20 shrink-0 items-center gap-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {assignee.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {assignee}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-x-3 gap-y-1">
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
                  <span className="shrink-0 text-xs text-gray-400">
                    {memberDone}/{memberTasks.length}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
