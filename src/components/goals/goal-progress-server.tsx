// Copyright 2026 Fractalyze Inc. All rights reserved.

import {
  getMergedHalfYearObjective,
  getMergedMonthlyGoals,
  getMergedWeeklyTasks,
  getAllHalfYearPeriods,
} from "@/lib/store/goals-merged";
import type { WeeklyTask } from "@/lib/types";
import {
  weekIdToMonth,
  weekIdToHalf,
  getWeekIdsForMonth,
} from "@/lib/week";
import { GoalProgress } from "./goal-progress";

interface GoalProgressServerProps {
  weekId: string;
}

export async function GoalProgressServer({ weekId }: GoalProgressServerProps) {
  const month = weekIdToMonth(weekId);
  const half = weekIdToHalf(weekId);
  const monthWeekIds = getWeekIdsForMonth(month);

  const [halfYear, monthlyGoals, ...weekTaskArrays] = await Promise.all([
    getMergedHalfYearObjective(half),
    getMergedMonthlyGoals(month),
    ...monthWeekIds.map((wId) => getMergedWeeklyTasks(wId)),
  ]);

  // Calculate all monthly goals in this half for progress bar
  const allPeriods = await getAllHalfYearPeriods();
  const [yearStr, halfStr] = half.split("-");
  const year = parseInt(yearStr, 10);
  const startMonth = halfStr === "H1" ? 1 : 7;
  const endMonth = halfStr === "H1" ? 6 : 12;

  let allMonthlyDone = 0;
  let allMonthlyTotal = 0;

  if (allPeriods.includes(half)) {
    for (let m = startMonth; m <= endMonth; m++) {
      const monthKey = `${year}-${String(m).padStart(2, "0")}`;
      const goals =
        monthKey === month ? monthlyGoals : await getMergedMonthlyGoals(monthKey);
      allMonthlyTotal += goals.length;
      allMonthlyDone += goals.filter((g) => g.status === "done").length;
    }
  }

  // Weekly achievement trend for the month
  const achievementTrend = monthWeekIds
    .map((wId, i) => {
      const tasks = weekTaskArrays[i];
      const done = tasks.filter((t) => t.status === "done").length;
      return {
        weekId: wId,
        label: wId.replace(/^\d{4}-/, ""),
        rate: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : -1,
      };
    })
    .filter((d) => d.rate >= 0);

  // All tasks across the month (for goal linking), deduplicated by ID
  // When the same task is carried across weeks, keep the latest version.
  const allMonthTasks = (() => {
    const byId = new Map<string, WeeklyTask>();
    for (const task of weekTaskArrays.flat()) {
      const existing = byId.get(task.id);
      if (!existing || task.updatedAt > existing.updatedAt) {
        byId.set(task.id, task);
      }
    }
    return Array.from(byId.values());
  })();

  return (
    <GoalProgress
      halfYear={halfYear}
      monthlyGoals={monthlyGoals}
      weeklyTasks={allMonthTasks.filter((t) => t.weekId === weekId)}
      month={month}
      allMonthlyDone={allMonthlyDone}
      allMonthlyTotal={allMonthlyTotal}
      allMonthTasks={allMonthTasks}
      currentWeekId={weekId}
      achievementTrend={achievementTrend}
    />
  );
}
