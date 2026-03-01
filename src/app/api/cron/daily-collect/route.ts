// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { collectGitHubMetrics } from "@/lib/collectors/github";
import { collectKnowledgeMetrics } from "@/lib/collectors/knowledge";
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

    // Collect metrics in parallel
    const [github, knowledge, contextSync] = await Promise.all([
      collectGitHubMetrics(weekId),
      collectKnowledgeMetrics(weekId),
      collectContextSyncMetrics(weekId),
    ]);

    // Save snapshot (overwrites current week's data with latest)
    const snapshot = assembleSnapshot(weekId, github, knowledge, contextSync);
    await saveSnapshot(snapshot);

    return NextResponse.json({
      status: "success",
      weekId,
      github: { totalMerged: github.totalMerged, totalOpen: github.totalOpen },
      knowledge: {
        created: knowledge.totalCreated,
        updated: knowledge.totalUpdated,
      },
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
