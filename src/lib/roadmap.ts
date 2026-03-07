// Copyright 2026 Fractalyze Inc. All rights reserved.

import type {
  HalfYearObjective,
  MonthlyGoal,
  WeeklyTask,
  RoadmapWeek,
  RoadmapMonth,
  RoadmapData,
} from "./types";
import { getWeekId, getWeekRange, getWeekIdsForMonth } from "./week";

/** Check if a task is blocking: deadline passed and not done. */
export function isTaskBlocking(task: WeeklyTask, now: Date): boolean {
  if (task.status === "done") return false;
  if (!task.deadline) return false;
  return new Date(task.deadline) < now;
}

/** Check if a month is at risk: has blocking tasks or progress behind schedule. */
export function isMonthAtRisk(
  month: RoadmapMonth,
  now: Date,
  currentMonth: string
): boolean {
  // Any blocking tasks in the month's weeks
  for (const week of month.weeks) {
    if (week.blockingCount > 0) return true;
  }

  // Only check progress expectation for current or past months
  if (month.month > currentMonth) return false;

  // If the month has goals but none are done yet while time has passed
  if (month.goals.length > 0 && month.month <= currentMonth) {
    const expectedRate = month.month < currentMonth ? 100 : 50;
    if (month.progressRate < expectedRate) return true;
  }

  return false;
}

/** Build a week label like "W10 · 3/2-3/8". */
function buildWeekLabel(weekId: string): string {
  const weekNum = weekId.split("-W")[1];
  const { start, end } = getWeekRange(weekId);
  const startM = start.getUTCMonth() + 1;
  const startD = start.getUTCDate();
  const endM = end.getUTCMonth() + 1;
  const endD = end.getUTCDate();
  const dateRange =
    startM === endM
      ? `${startM}/${startD}-${endD}`
      : `${startM}/${startD}-${endM}/${endD}`;
  return `W${weekNum} · ${dateRange}`;
}

/** Compute full roadmap data for a half-year period. */
export function computeRoadmapData(
  halfYear: HalfYearObjective | null,
  monthsData: {
    month: string;
    goals: MonthlyGoal[];
    weekTasks: Map<string, WeeklyTask[]>;
  }[],
  now: Date = new Date()
): RoadmapData {
  const currentWeekId = getWeekId(now);
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  let totalGoals = 0;
  let doneGoals = 0;

  const months: RoadmapMonth[] = monthsData.map((md) => {
    const weekIds = getWeekIdsForMonth(md.month);

    const weeks: RoadmapWeek[] = weekIds.map((weekId) => {
      const tasks = md.weekTasks.get(weekId) ?? [];
      const doneCount = tasks.filter((t) => t.status === "done").length;
      const blockingCount = tasks.filter((t) => isTaskBlocking(t, now)).length;

      return {
        weekId,
        weekLabel: buildWeekLabel(weekId),
        tasks,
        achievementRate:
          tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : -1,
        blockingCount,
        isCurrent: weekId === currentWeekId,
      };
    });

    const monthDone = md.goals.filter((g) => g.status === "done").length;
    totalGoals += md.goals.length;
    doneGoals += monthDone;

    const progressRate =
      md.goals.length > 0
        ? Math.round((monthDone / md.goals.length) * 100)
        : 0;

    const monthNum = parseInt(md.month.split("-")[1], 10);

    const roadmapMonth: RoadmapMonth = {
      month: md.month,
      label: `${monthNum}월`,
      goals: md.goals,
      weeks,
      progressRate,
      isAtRisk: false,
      isCurrent: md.month === currentMonth,
    };

    roadmapMonth.isAtRisk = isMonthAtRisk(roadmapMonth, now, currentMonth);

    return roadmapMonth;
  });

  const halfProgress =
    totalGoals > 0 ? Math.round((doneGoals / totalGoals) * 100) : 0;

  return {
    halfYear,
    halfProgress,
    months,
    currentWeekId,
  };
}
