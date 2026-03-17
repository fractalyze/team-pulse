// Copyright 2026 Fractalyze Inc. All rights reserved.

import {
  getMergedHalfYearObjective,
  getMergedMonthlyGoals,
  getMergedWeeklyTasks,
  getAllHalfYearPeriods,
} from "@/lib/store/goals-merged";
import type { GoalStatus, MonthlyGoal, WeeklyTask } from "@/lib/types";
import {
  weekIdToMonth,
  weekIdToHalf,
  getWeekIdsForMonth,
} from "@/lib/week";
import { GoalProgress } from "./goal-progress";

/** Compute monthly goal status from linked weekly tasks. */
function computeGoalStatus(tasks: WeeklyTask[], fallback: GoalStatus): GoalStatus {
  if (tasks.length === 0) return fallback;
  if (tasks.some((t) => t.status === "in_progress")) return "in_progress";
  if (tasks.every((t) => t.status === "done")) return "done";
  if (tasks.every((t) => t.status === "closed")) return "closed";
  if (tasks.every((t) => t.status === "done" || t.status === "closed"))
    return "done";
  if (tasks.some((t) => t.status !== "not_started")) return "in_progress";
  return "not_started";
}

/** Apply auto-computed status to monthly goals based on linked weekly tasks. */
function applyAutoStatus(
  goals: MonthlyGoal[],
  allTasks: WeeklyTask[]
): MonthlyGoal[] {
  const tasksByGoalId = new Map<string, WeeklyTask[]>();
  for (const t of allTasks) {
    if (!t.goalId) continue;
    if (!tasksByGoalId.has(t.goalId)) tasksByGoalId.set(t.goalId, []);
    tasksByGoalId.get(t.goalId)!.push(t);
  }
  return goals.map((g) => {
    const linked = tasksByGoalId.get(g.id) ?? [];
    if (linked.length === 0) return g;
    return { ...g, status: computeGoalStatus(linked, g.status) };
  });
}

interface GoalProgressServerProps {
  weekId: string;
}

function nextMonth(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10) + 1;
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export async function GoalProgressServer({ weekId }: GoalProgressServerProps) {
  const month = weekIdToMonth(weekId);
  const half = weekIdToHalf(weekId);
  const monthWeekIds = getWeekIdsForMonth(month);
  const next = nextMonth(month);

  const [halfYear, monthlyGoals, nextMonthGoals, ...weekTaskArrays] = await Promise.all([
    getMergedHalfYearObjective(half),
    getMergedMonthlyGoals(month),
    getMergedMonthlyGoals(next),
    ...monthWeekIds.map((wId) => getMergedWeeklyTasks(wId)),
  ]);

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

  // Apply auto-computed status to current month's goals based on linked tasks
  const monthlyGoalsWithAuto = applyAutoStatus(monthlyGoals, allMonthTasks);

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
      if (monthKey === month) {
        allMonthlyTotal += monthlyGoalsWithAuto.length;
        allMonthlyDone += monthlyGoalsWithAuto.filter((g) => g.status === "done").length;
      } else {
        const otherMonthWeekIds = getWeekIdsForMonth(monthKey);
        const [otherGoals, ...otherTaskArrays] = await Promise.all([
          getMergedMonthlyGoals(monthKey),
          ...otherMonthWeekIds.map((wId) => getMergedWeeklyTasks(wId)),
        ]);
        const otherTasks = otherTaskArrays.flat();
        const otherGoalsWithAuto = applyAutoStatus(otherGoals, otherTasks);
        allMonthlyTotal += otherGoalsWithAuto.length;
        allMonthlyDone += otherGoalsWithAuto.filter((g) => g.status === "done").length;
      }
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

  return (
    <GoalProgress
      halfYear={halfYear}
      monthlyGoals={monthlyGoalsWithAuto}
      weeklyTasks={allMonthTasks}
      month={month}
      allMonthlyDone={allMonthlyDone}
      allMonthlyTotal={allMonthlyTotal}
      allMonthTasks={allMonthTasks}
      currentWeekId={weekId}
      achievementTrend={achievementTrend}
      nextMonth={next}
      nextMonthGoals={nextMonthGoals}
    />
  );
}
