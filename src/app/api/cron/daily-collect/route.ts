// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { collectGitHubMetrics, computePendingReviews } from "@/lib/collectors/github";
import { collectProjectMetrics } from "@/lib/collectors/github-projects";
import { collectContextSyncMetrics } from "@/lib/collectors/notion";
import { syncGitHubProjectToRedis } from "@/lib/collectors/github-project";
import { assembleSnapshot } from "@/lib/generators/metrics";
import { saveSnapshot, saveDailyPending } from "@/lib/store/kv";
import { getWeekId } from "@/lib/week";
import { getTeam } from "@/lib/team";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const weekId = getWeekId();
    console.log(`Running daily collect for ${weekId}`);

    const team = await getTeam();

    const [github, contextSync, project, ghProjectSync] = await Promise.all([
      collectGitHubMetrics(weekId, team),
      collectContextSyncMetrics(weekId),
      collectProjectMetrics(weekId),
      syncGitHubProjectToRedis().catch((e) => {
        console.error("GitHub Project sync failed:", e);
        return null;
      }),
    ]);

    const snapshot = assembleSnapshot(weekId, github, contextSync, {
      weekId,
      objectives: [],
      thisWeekGoal: null,
      nextHardDeadline: null,
    }, project);
    await saveSnapshot(snapshot);

    // Save daily pending review counts
    const pendingEntry = computePendingReviews(github);
    await saveDailyPending(weekId, pendingEntry);

    return NextResponse.json({
      status: "success",
      weekId,
      github: { totalMerged: github.totalMerged, totalOpen: github.totalOpen },
      contextSync: { sessions: contextSync.totalSessions },
      project: { items: project.items.length, goals: project.goalProgress.length },
      ghProject: ghProjectSync,
    });
  } catch (error) {
    console.error("Daily collect failed:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
