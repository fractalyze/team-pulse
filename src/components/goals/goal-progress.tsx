// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useState, useMemo } from "react";
import type {
  GoalStatus,
  HalfYearObjective,
  MonthlyGoal,
  WeeklyTask,
} from "@/lib/types";
import { MiniAchievementBars } from "@/components/charts/achievement-mini";

interface AchievementPoint {
  weekId: string;
  label: string;
  rate: number;
}

interface GoalProgressProps {
  halfYear: HalfYearObjective | null;
  monthlyGoals: MonthlyGoal[];
  weeklyTasks: WeeklyTask[];
  month: string;
  allMonthlyDone: number;
  allMonthlyTotal: number;
  allMonthTasks: WeeklyTask[];
  currentWeekId: string;
  achievementTrend: AchievementPoint[];
}

const STATUS_ICON: Record<GoalStatus, string> = {
  done: "\u2713",
  in_progress: "\u25D0",
  not_started: "\u25CB",
};

const ICON_COLOR: Record<GoalStatus, string> = {
  done: "text-green-500",
  in_progress: "text-blue-500",
  not_started: "text-gray-400",
};

const GOAL_CARD_BORDER: Record<GoalStatus, string> = {
  done: "border-green-200 dark:border-green-800",
  in_progress: "border-blue-200 dark:border-blue-800",
  not_started: "border-gray-200 dark:border-gray-700",
};

const GOAL_CARD_BG: Record<GoalStatus, string> = {
  done: "bg-green-50/50 dark:bg-green-950/30",
  in_progress: "bg-blue-50/50 dark:bg-blue-950/30",
  not_started: "bg-gray-50/50 dark:bg-gray-800/30",
};

const PROGRESS_RING_SIZE = 80;
const PROGRESS_RING_STROKE = 6;
const PROGRESS_RING_RADIUS = (PROGRESS_RING_SIZE - PROGRESS_RING_STROKE) / 2;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;

function ProgressRing({ percent }: { percent: number }) {
  const offset =
    PROGRESS_RING_CIRCUMFERENCE -
    (percent / 100) * PROGRESS_RING_CIRCUMFERENCE;

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
          <linearGradient
            id="progressGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
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

function goalStatus(tasks: WeeklyTask[]): GoalStatus {
  if (tasks.length === 0) return "not_started";
  if (tasks.every((t) => t.status === "done")) return "done";
  if (tasks.some((t) => t.status !== "not_started")) return "in_progress";
  return "not_started";
}

export function GoalProgress({
  halfYear,
  monthlyGoals,
  weeklyTasks,
  month,
  allMonthlyDone,
  allMonthlyTotal,
  allMonthTasks,
  currentWeekId,
  achievementTrend,
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

  const monthLabel = month
    ? `${parseInt(month.split("-")[1], 10)}월`
    : "";

  // Group all month tasks by goalId
  const { goalTaskMap, otherTasks } = useMemo(() => {
    const goalMap = new Map<string, WeeklyTask[]>();
    const other: WeeklyTask[] = [];

    for (const task of allMonthTasks) {
      if (task.goalId) {
        if (!goalMap.has(task.goalId)) goalMap.set(task.goalId, []);
        goalMap.get(task.goalId)!.push(task);
      } else {
        other.push(task);
      }
    }

    return { goalTaskMap: goalMap, otherTasks: other };
  }, [allMonthTasks]);

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
              Weekly Goal {weekDone}/{weekTotal}
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {halfPct}%
            </span>
          </div>
        </div>
      </button>
    );
  }

  const otherDone = otherTasks.filter((t) => t.status === "done").length;

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
                  Monthly Goal {allMonthlyDone}/{allMonthlyTotal}
                </span>
                <span>|</span>
                <span>
                  Weekly Goal {weekDone}/{weekTotal} ({weekPct}%)
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
              Weekly Goal {weekDone}/{weekTotal}
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

      {/* Monthly goals as cards with linked tasks */}
      {monthlyGoals.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {monthLabel} Goals
            </span>
            <span className="text-xs text-gray-400">
              {monthDone}/{monthlyGoals.length} done
            </span>
          </div>
          <div className="space-y-2.5">
            {monthlyGoals.map((goal) => {
              const linkedTasks = goalTaskMap.get(goal.id) ?? [];
              const linkedDone = linkedTasks.filter(
                (t) => t.status === "done"
              ).length;
              const taskProgress =
                linkedTasks.length > 0 ? goalStatus(linkedTasks) : goal.status;

              return (
                <div
                  key={goal.id}
                  className={`rounded-lg border px-4 py-3 ${GOAL_CARD_BORDER[goal.status]} ${GOAL_CARD_BG[goal.status]}`}
                >
                  {/* Goal header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-base ${ICON_COLOR[goal.status]}`}>
                        {STATUS_ICON[goal.status]}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {goal.title}
                      </span>
                    </div>
                    {linkedTasks.length > 0 && (
                      <span className="text-xs text-gray-400">
                        {linkedDone}/{linkedTasks.length} done
                      </span>
                    )}
                  </div>

                  {/* Linked tasks */}
                  {linkedTasks.length > 0 && (
                    <div className="mt-2 space-y-1 pl-6">
                      {linkedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className={ICON_COLOR[task.status]}>
                            {STATUS_ICON[task.status]}
                          </span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {task.content}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({task.assignee})
                          </span>
                          {task.deadline && (
                            <span className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-500 dark:bg-gray-800">
                              {task.deadline.slice(5)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No linked tasks indicator */}
                  {linkedTasks.length === 0 && (
                    <p className="mt-1 pl-6 text-xs text-gray-400">
                      no linked tasks
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Other tasks (not linked to any goal) */}
      {otherTasks.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Other Tasks
            </span>
            <span className="text-xs text-gray-400">
              {otherDone}/{otherTasks.length} done
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {otherTasks.map((task) => (
              <span
                key={task.id}
                className="flex items-center gap-1 text-sm"
              >
                <span className={ICON_COLOR[task.status]}>
                  {STATUS_ICON[task.status]}
                </span>
                <span className="text-xs text-gray-400">{task.assignee}:</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {task.content}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Achievement mini bars */}
      {achievementTrend.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Weekly Achievement
            </span>
            <span className="text-xs text-gray-400">current month</span>
          </div>
          <MiniAchievementBars
            data={achievementTrend}
            currentWeekId={currentWeekId}
          />
        </div>
      )}
    </div>
  );
}
