// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Suspense } from "react";
import Link from "next/link";
import { getDashboardSummary } from "@/lib/store/kv";
import { GoalProgressServer } from "@/components/goals/goal-progress-server";
import { GoalProgressSkeleton } from "@/components/goals/goal-progress-skeleton";
import { CrossRepoMilestones } from "@/components/milestones/cross-repo-milestones";
import { DashboardContent } from "../../dashboard-content";
import { WeekNav } from "../../week-nav";

export const dynamic = "force-dynamic";

interface WeekPageProps {
  params: Promise<{ id: string }>;
}

export default async function WeekPage({ params }: WeekPageProps) {
  const { id } = await params;
  const summary = await getDashboardSummary(id);

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Week {id}
        </h1>
        <p className="text-gray-500">No data found for this week.</p>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to current week
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WeekNav summary={summary} />
      <Suspense fallback={<GoalProgressSkeleton />}>
        <GoalProgressServer weekId={id} />
      </Suspense>
      <DashboardContent summary={summary} />

      {/* Team Milestones (cross-repo) */}
      {(summary.current.crossRepoMilestones ?? []).length > 0 && (
        <CrossRepoMilestones
          milestones={summary.current.crossRepoMilestones!}
        />
      )}
    </div>
  );
}
