// Copyright 2026 Fractalyze Inc. All rights reserved.

import {
  getHalfYearObjective,
  getMonthlyGoals,
  getWeeklyTasks,
  getAllHalfYearPeriods,
} from "@/lib/store/goals";
import { weekIdToMonth, weekIdToHalf } from "@/lib/week";
import { GoalProgress } from "./goal-progress";

interface GoalProgressServerProps {
  weekId: string;
}

export async function GoalProgressServer({ weekId }: GoalProgressServerProps) {
  const month = weekIdToMonth(weekId);
  const half = weekIdToHalf(weekId);

  const [halfYear, monthlyGoals, weeklyTasks] = await Promise.all([
    getHalfYearObjective(half),
    getMonthlyGoals(month),
    getWeeklyTasks(weekId),
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
      const goals = monthKey === month ? monthlyGoals : await getMonthlyGoals(monthKey);
      allMonthlyTotal += goals.length;
      allMonthlyDone += goals.filter((g) => g.status === "done").length;
    }
  }

  return (
    <GoalProgress
      halfYear={halfYear}
      monthlyGoals={monthlyGoals}
      weeklyTasks={weeklyTasks}
      month={month}
      allMonthlyDone={allMonthlyDone}
      allMonthlyTotal={allMonthlyTotal}
    />
  );
}
