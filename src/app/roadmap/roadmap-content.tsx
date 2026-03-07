// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useState, useCallback, useMemo } from "react";
import type { GoalStatus, RoadmapData } from "@/lib/types";
import { TimelineMonth } from "./timeline-month";
import { AchievementTrendChart } from "@/components/charts/achievement-trend";

interface RoadmapContentProps {
  data: RoadmapData;
}

const STATUS_CYCLE: GoalStatus[] = ["not_started", "in_progress", "done"];

function nextStatus(current: GoalStatus): GoalStatus {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

export function RoadmapContent({ data }: RoadmapContentProps) {
  const [roadmap, setRoadmap] = useState(data);

  const handleGoalStatusChange = useCallback(
    async (month: string, goalId: string, currentStatus: GoalStatus) => {
      const newStatus = nextStatus(currentStatus);

      // Optimistic update
      setRoadmap((prev) => {
        const months = prev.months.map((m) => {
          if (m.month !== month) return m;
          const goals = m.goals.map((g) =>
            g.id === goalId ? { ...g, status: newStatus } : g
          );
          const doneCount = goals.filter((g) => g.status === "done").length;
          return {
            ...m,
            goals,
            progressRate:
              goals.length > 0
                ? Math.round((doneCount / goals.length) * 100)
                : 0,
          };
        });

        const totalGoals = months.reduce((s, m) => s + m.goals.length, 0);
        const totalDone = months.reduce(
          (s, m) => s + m.goals.filter((g) => g.status === "done").length,
          0
        );

        return {
          ...prev,
          months,
          halfProgress:
            totalGoals > 0 ? Math.round((totalDone / totalGoals) * 100) : 0,
        };
      });

      try {
        await fetch("/api/goals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier: "month",
            month,
            id: goalId,
            status: newStatus,
          }),
        });
      } catch {
        // Revert on error
        setRoadmap((prev) => {
          const months = prev.months.map((m) => {
            if (m.month !== month) return m;
            const goals = m.goals.map((g) =>
              g.id === goalId ? { ...g, status: currentStatus } : g
            );
            const doneCount = goals.filter((g) => g.status === "done").length;
            return {
              ...m,
              goals,
              progressRate:
                goals.length > 0
                  ? Math.round((doneCount / goals.length) * 100)
                  : 0,
            };
          });
          return { ...prev, months };
        });
      }
    },
    []
  );

  const achievementData = useMemo(() => {
    const seen = new Set<string>();
    const points: {
      weekId: string;
      label: string;
      rate: number;
      isCurrent: boolean;
    }[] = [];
    for (const month of roadmap.months) {
      for (const week of month.weeks) {
        if (seen.has(week.weekId)) continue;
        seen.add(week.weekId);
        if (week.tasks.length === 0) continue;
        points.push({
          weekId: week.weekId,
          label: week.weekId.replace(/^\d{4}-/, ""),
          rate: week.achievementRate,
          isCurrent: week.isCurrent,
        });
      }
    }
    return points;
  }, [roadmap.months]);

  return (
    <div className="relative">
      {/* Half-year header */}
      {roadmap.halfYear && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900 dark:text-white">
              {roadmap.halfYear.period}: {roadmap.halfYear.title}
            </span>
            <span className="text-sm text-gray-500">
              {roadmap.months.reduce(
                (s, m) => s + m.goals.filter((g) => g.status === "done").length,
                0
              )}
              /{roadmap.months.reduce((s, m) => s + m.goals.length, 0)} (
              {roadmap.halfProgress}%)
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
              style={{ width: `${roadmap.halfProgress}%` }}
            />
          </div>
          {roadmap.halfYear.description && (
            <p className="mt-1 text-xs text-gray-500">
              {roadmap.halfYear.description}
            </p>
          )}
        </div>
      )}

      {/* Achievement trend chart */}
      {achievementData.length > 0 && (
        <div className="mt-4 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Weekly Achievement Trend
          </h3>
          <AchievementTrendChart data={achievementData} />
        </div>
      )}

      {/* Month swimlanes */}
      <div className="mt-4 space-y-4">
        {roadmap.months.map((month) => (
          <TimelineMonth
            key={month.month}
            month={month}
            onGoalStatusChange={handleGoalStatusChange}
          />
        ))}
      </div>

    </div>
  );
}
