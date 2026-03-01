// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { collectGitHubMetrics } from "@/lib/collectors/github";
import { collectContextSyncMetrics } from "@/lib/collectors/notion";
import { assembleSnapshot } from "@/lib/generators/metrics";
import { saveSnapshot } from "@/lib/store/kv";
import { getWeekId } from "@/lib/week";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const weekId = getWeekId();
    console.log(`Running daily collect for ${weekId}`);

    const [github, contextSync] = await Promise.all([
      collectGitHubMetrics(weekId),
      collectContextSyncMetrics(weekId),
    ]);

    // Save snapshot with empty OKR (OKR is collected in weekly-pulse only)
    const snapshot = assembleSnapshot(weekId, github, contextSync, {
      weekId,
      objectives: [],
      thisWeekGoal: null,
      nextHardDeadline: null,
    });
    await saveSnapshot(snapshot);

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
