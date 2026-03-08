// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { collectGitHubMetrics, collectCrossRepoMilestones } from "@/lib/collectors/github";
import { collectContextSyncMetrics } from "@/lib/collectors/notion";
import { assembleSnapshot } from "@/lib/generators/metrics";
import { saveSnapshot } from "@/lib/store/kv";
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

    const [github, contextSync] = await Promise.all([
      collectGitHubMetrics(weekId, team),
      collectContextSyncMetrics(weekId),
    ]);

    const crossRepoMilestones = await collectCrossRepoMilestones();

    // Save snapshot with empty OKR (OKR is collected in weekly-pulse only)
    const snapshot = assembleSnapshot(weekId, github, contextSync, {
      weekId,
      objectives: [],
      thisWeekGoal: null,
      nextHardDeadline: null,
    }, team, crossRepoMilestones);
    await saveSnapshot(snapshot);

    // Claude Code usage is collected via OTel (real-time push from Claude Code)

    return NextResponse.json({
      status: "success",
      weekId,
      github: { totalMerged: github.totalMerged, totalOpen: github.totalOpen },
      contextSync: { sessions: contextSync.totalSessions },
    });
  } catch (error) {
    console.error("Daily collect failed:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
