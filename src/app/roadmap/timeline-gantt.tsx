// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useMemo } from "react";
import type { GoalStatus, RoadmapMonth } from "@/lib/types";
import { getWeekRange } from "@/lib/week";
import { isTaskBlocking } from "@/lib/roadmap";

const BAR_BG: Record<GoalStatus, string> = {
  done: "bg-green-500 dark:bg-green-600",
  in_progress: "bg-blue-500 dark:bg-blue-600",
  not_started: "bg-gray-300 dark:bg-gray-600",
  closed: "bg-red-400 dark:bg-red-600",
};

const BAR_TEXT: Record<GoalStatus, string> = {
  done: "text-white",
  in_progress: "text-white",
  not_started: "text-gray-700 dark:text-gray-200",
  closed: "text-white",
};

interface TimelineGanttProps {
  month: RoadmapMonth;
}

interface TaskBar {
  id: string;
  content: string;
  status: GoalStatus;
  deadline: string;
  leftPct: number;
  widthPct: number;
  isBlocking: boolean;
  isGithub: boolean;
  githubUrl?: string;
}

const DAY_MS = 86_400_000;

function toUtcMidnight(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

export function TimelineGantt({ month }: TimelineGanttProps) {
  const now = useMemo(() => new Date(), []);

  const { monthStart, totalDays, days } = useMemo(() => {
    const [yearStr, monthStr] = month.month.split("-");
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10) - 1;
    const monthStart = new Date(Date.UTC(year, m, 1));
    const totalDays = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();

    const days: Date[] = [];
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(Date.UTC(year, m, d)));
    }

    return { monthStart, totalDays, days };
  }, [month.month]);

  const assigneeBars = useMemo(() => {
    const map = new Map<string, TaskBar[]>();
    const monthLast = new Date(
      monthStart.getTime() + (totalDays - 1) * DAY_MS
    );

    // Deduplicate tasks carried across weeks — keep the latest version
    const taskById = new Map<string, { task: typeof month.weeks[0]["tasks"][0]; weekId: string }>();
    for (const week of month.weeks) {
      for (const task of week.tasks) {
        const existing = taskById.get(task.id);
        if (!existing || task.updatedAt > existing.task.updatedAt) {
          taskById.set(task.id, { task, weekId: week.weekId });
        }
      }
    }

    for (const { task } of taskById.values()) {
        const { start: weekStart, end: weekEnd } = getWeekRange(task.weekId);

        const taskStart = task.startDate
          ? new Date(task.startDate)
          : toUtcMidnight(weekStart);
        const taskEnd = task.deadline
          ? new Date(task.deadline) // "YYYY-MM-DD" → UTC midnight
          : toUtcMidnight(weekEnd);

        // Clamp to month boundaries
        const barStart = taskStart < monthStart ? monthStart : taskStart;
        const barEnd = taskEnd > monthLast ? monthLast : taskEnd;

        // Skip if entirely outside the month
        if (barStart > monthLast || barEnd < monthStart) continue;

        const leftDays =
          (barStart.getTime() - monthStart.getTime()) / DAY_MS;
        const widthDays =
          (barEnd.getTime() - barStart.getTime()) / DAY_MS + 1;

        const bar: TaskBar = {
          id: task.id,
          content: task.content,
          status: task.status,
          deadline: task.deadline,
          leftPct: (leftDays / totalDays) * 100,
          widthPct: Math.max(
            (widthDays / totalDays) * 100,
            (1 / totalDays) * 100
          ),
          isBlocking: isTaskBlocking(task, now),
          isGithub: task.source === "github",
          githubUrl: task.githubUrl,
        };

        if (!map.has(task.assignee)) map.set(task.assignee, []);
        map.get(task.assignee)!.push(bar);
    }

    return map;
  }, [month.weeks, monthStart, totalDays, now]);

  // Today marker position (use local date for user's timezone)
  const todayPct = useMemo(() => {
    const todayUtc = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    );
    if (todayUtc < monthStart) return null;
    const dayOffset = (todayUtc.getTime() - monthStart.getTime()) / DAY_MS;
    if (dayOffset >= totalDays) return null;
    return ((dayOffset + 0.5) / totalDays) * 100;
  }, [now, monthStart, totalDays]);

  if (assigneeBars.size === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        No tasks for this month
      </div>
    );
  }

  const colW = `${100 / totalDays}%`;

  return (
    <div className="px-4 py-3">
      <div className="min-w-0">
        {/* Date header */}
        <div className="flex">
          <div className="w-20 shrink-0" />
          <div className="flex flex-1">
            {days.map((day, i) => {
              const dayNum = day.getUTCDate();
              const m = day.getUTCMonth() + 1;
              const isWeekend =
                day.getUTCDay() === 0 || day.getUTCDay() === 6;
              const showLabel = (dayNum - 1) % 3 === 0;

              return (
                <div key={i} className="text-center" style={{ width: colW }}>
                  {showLabel && (
                    <span
                      className={`text-[10px] leading-none ${
                        isWeekend
                          ? "text-gray-400 dark:text-gray-500"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {m}/{dayNum}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Assignee rows */}
        {[...assigneeBars.entries()].map(([assignee, bars]) => (
          <div
            key={assignee}
            className="flex border-t border-gray-100 dark:border-gray-800"
          >
            <div className="w-20 shrink-0 truncate py-1 pr-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400">
              {assignee}
            </div>
            <div className="relative flex-1 py-1">
              {/* Weekend backgrounds */}
              <div className="pointer-events-none absolute inset-0 flex">
                {days.map((day, i) => (
                  <div
                    key={i}
                    className={
                      day.getUTCDay() === 0 || day.getUTCDay() === 6
                        ? "bg-gray-50 dark:bg-gray-800/50"
                        : ""
                    }
                    style={{ width: colW }}
                  />
                ))}
              </div>

              {/* Today marker */}
              {todayPct !== null && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-10 border-l border-dashed border-red-500"
                  style={{ left: `${todayPct}%` }}
                />
              )}

              {/* Task bars */}
              <div className="relative space-y-0.5">
                {bars.map((bar) => {
                  const barEl = (
                    <div
                      key={bar.id}
                      className={`relative h-5 truncate rounded px-1 text-[10px] font-medium leading-5 ${BAR_BG[bar.status]} ${BAR_TEXT[bar.status]} ${bar.isBlocking ? "ring-2 ring-red-500" : ""} ${bar.isGithub ? "border-l-2 border-dashed border-white/60" : ""}`}
                      style={{
                        marginLeft: `${bar.leftPct}%`,
                        width: `${bar.widthPct}%`,
                      }}
                      title={`${bar.isGithub ? "[DEV] " : ""}${bar.content}${bar.deadline ? ` (~ ${bar.deadline.slice(5)})` : ""}${bar.isBlocking ? " ⚠ Overdue" : ""}`}
                    >
                      {bar.content}
                    </div>
                  );

                  if (bar.isGithub && bar.githubUrl) {
                    return (
                      <a
                        key={bar.id}
                        href={bar.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {barEl}
                      </a>
                    );
                  }
                  return barEl;
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center border-t border-gray-100 pt-2 dark:border-gray-800">
          <div className="w-20 shrink-0" />
          <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-4 rounded bg-green-500 dark:bg-green-600" />
              done
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-4 rounded bg-blue-500 dark:bg-blue-600" />
              in progress
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-4 rounded bg-gray-300 dark:bg-gray-600" />
              not started
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-4 rounded bg-red-400 dark:bg-red-600" />
              closed
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-4 rounded ring-2 ring-red-500" />
              overdue
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
