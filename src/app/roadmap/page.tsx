// Copyright 2026 Fractalyze Inc. All rights reserved.

import {
  getMergedHalfYearObjective,
  getMergedMonthlyGoals,
  getMergedWeeklyTasks,
} from "@/lib/store/goals-merged";
import { getWeekId, weekIdToHalf, getWeekIdsForMonth } from "@/lib/week";
import { computeRoadmapData } from "@/lib/roadmap";
import type { WeeklyTask } from "@/lib/types";
import { RoadmapContent } from "./roadmap-content";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const now = new Date();
  const currentWeekId = getWeekId(now);
  const halfPeriod = weekIdToHalf(currentWeekId);
  const [, halfStr] = halfPeriod.split("-");
  const year = parseInt(halfPeriod.split("-")[0], 10);
  const startMonth = halfStr === "H1" ? 1 : 7;

  let halfYear = null;
  try {
    halfYear = await getMergedHalfYearObjective(halfPeriod);
  } catch {
    // KV not configured
  }

  const monthsData: {
    month: string;
    goals: Awaited<ReturnType<typeof getMergedMonthlyGoals>>;
    weekTasks: Map<string, WeeklyTask[]>;
  }[] = [];

  try {
    const monthEntries = Array.from({ length: 6 }, (_, i) => {
      const m = startMonth + i;
      return `${year}-${String(m).padStart(2, "0")}`;
    });

    // Fetch all months and their weeks in parallel
    await Promise.all(
      monthEntries.map(async (month) => {
        const [goals, weekIds] = await Promise.all([
          getMergedMonthlyGoals(month),
          Promise.resolve(getWeekIdsForMonth(month)),
        ]);

        const weekTasksList = await Promise.all(
          weekIds.map(async (weekId) => ({
            weekId,
            tasks: await getMergedWeeklyTasks(weekId),
          }))
        );

        const weekTasks = new Map<string, WeeklyTask[]>();
        for (const { weekId, tasks } of weekTasksList) {
          weekTasks.set(weekId, tasks);
        }

        monthsData.push({ month, goals, weekTasks });
      })
    );

    // Sort by month
    monthsData.sort((a, b) => a.month.localeCompare(b.month));
  } catch {
    // KV not configured
  }

  const roadmapData = computeRoadmapData(halfYear, monthsData, now);

  if (!roadmapData.halfYear && roadmapData.months.every((m) => m.goals.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Roadmap
        </h1>
        <p className="text-gray-500">
          No goals set. Add a half-year objective and monthly goals in Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Roadmap
      </h1>
      <RoadmapContent data={roadmapData} />
    </div>
  );
}
