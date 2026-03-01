// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { hasWeeklySyncToday } from "@/lib/collectors/gcal";
import { collectGitHubMetrics } from "@/lib/collectors/github";
import { collectKnowledgeMetrics } from "@/lib/collectors/knowledge";
import { collectContextSyncMetrics } from "@/lib/collectors/notion";
import { collectOKRMetrics } from "@/lib/collectors/okr";
import { createWeeklySyncPage } from "@/lib/generators/notion-page";
import { computePropagation } from "@/lib/generators/propagation";
import {
  sendChannelSummary,
  sendIndividualDMs,
} from "@/lib/generators/slack-msg";
import { assembleSnapshot, computeDelta } from "@/lib/generators/metrics";
import { saveSnapshot, getSnapshot } from "@/lib/store/kv";
import { getWeekId, getPreviousWeekId, formatDateKST } from "@/lib/week";

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Step 1: Check if today has a Weekly Sync event
    let hasEvent = false;
    try {
      hasEvent = await hasWeeklySyncToday();
    } catch (error) {
      console.warn("Calendar check failed, proceeding anyway:", error);
      // If calendar is not configured, check if today is Friday (KST)
      const now = new Date();
      const kstDay = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCDay();
      hasEvent = kstDay === 5; // Friday
    }

    if (!hasEvent) {
      return NextResponse.json({
        status: "skipped",
        reason: "No Weekly Sync event today",
      });
    }

    const weekId = getWeekId();
    console.log(`Running weekly pulse for ${weekId}`);

    // Step 2: Collect all metrics in parallel (OKR is optional)
    const [github, knowledge, contextSync] = await Promise.all([
      collectGitHubMetrics(weekId),
      collectKnowledgeMetrics(weekId),
      collectContextSyncMetrics(weekId),
    ]);

    let okr: Awaited<ReturnType<typeof collectOKRMetrics>>;
    try {
      okr = await collectOKRMetrics(weekId);
    } catch (error) {
      console.warn("OKR collection failed, using empty defaults:", error);
      okr = {
        weekId,
        objectives: [],
        thisWeekGoal: null,
        nextHardDeadline: null,
      };
    }

    // Step 3: Compute propagation
    const propagation = computePropagation(github, knowledge, contextSync);

    // Step 4: Get previous week data for delta
    const previousWeekId = getPreviousWeekId(weekId);
    const previousSnapshot = await getSnapshot(previousWeekId);
    const currentSnapshot = assembleSnapshot(
      weekId,
      github,
      knowledge,
      contextSync,
      okr,
      propagation
    );
    const delta = computeDelta(currentSnapshot, previousSnapshot);

    // Step 5: Save snapshot to KV
    await saveSnapshot(currentSnapshot);

    // Step 6: Create Notion meeting note
    let notionPageId: string | null = null;
    try {
      notionPageId = await createWeeklySyncPage(
        github,
        knowledge,
        contextSync,
        okr,
        propagation,
        delta
      );
    } catch (error) {
      console.error("Failed to create Notion page:", error);
    }

    const notionPageUrl = notionPageId
      ? `https://notion.so/${notionPageId.replace(/-/g, "")}`
      : null;

    // Step 7: Send Slack messages
    try {
      await sendChannelSummary(
        github,
        knowledge,
        contextSync,
        okr,
        delta,
        notionPageUrl
      );
    } catch (error) {
      console.error("Failed to send Slack channel summary:", error);
    }

    try {
      const weekLabel = `${formatDateKST(new Date())} 주차`;
      await sendIndividualDMs(
        github,
        knowledge,
        contextSync,
        weekLabel,
        notionPageUrl
      );
    } catch (error) {
      console.error("Failed to send Slack DMs:", error);
    }

    return NextResponse.json({
      status: "success",
      weekId,
      github: {
        totalMerged: github.totalMerged,
        totalOpen: github.totalOpen,
        totalCommits: github.totalCommits,
      },
      knowledge: {
        created: knowledge.totalCreated,
        updated: knowledge.totalUpdated,
      },
      contextSync: {
        sessions: contextSync.totalSessions,
      },
      okr: {
        objectives: okr.objectives.length,
      },
      propagation: {
        total: propagation.length,
        gaps: propagation.filter((p) => p.propagationScore === 0).length,
      },
      notionPageId,
      delta,
    });
  } catch (error) {
    console.error("Weekly pulse failed:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
