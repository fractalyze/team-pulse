// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { hasWeeklySyncToday } from "@/lib/collectors/gcal";
import { collectOKRMetrics } from "@/lib/collectors/okr";
import { createWeeklySyncPage } from "@/lib/generators/notion-page";
import {
  sendChannelSummary,
  sendIndividualDMs,
} from "@/lib/generators/slack-msg";
import { computeDelta } from "@/lib/generators/metrics";
import { getSnapshot, saveSnapshot } from "@/lib/store/kv";
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

    // Step 2: Read snapshot from Redis (saved by daily-collect)
    let currentSnapshot = await getSnapshot(weekId);
    if (!currentSnapshot) {
      return NextResponse.json({
        status: "skipped",
        reason: `No snapshot found for ${weekId}. daily-collect may not have run yet.`,
      });
    }

    // Step 3: Collect OKR (not in daily-collect)
    let okr = currentSnapshot.okr;
    try {
      okr = await collectOKRMetrics(weekId);
      // Update snapshot with fresh OKR data
      currentSnapshot = { ...currentSnapshot, okr };
      await saveSnapshot(currentSnapshot);
    } catch (error) {
      console.warn("OKR collection failed, using existing data:", error);
    }

    // Step 4: Compute delta
    const previousWeekId = getPreviousWeekId(weekId);
    const previousSnapshot = await getSnapshot(previousWeekId);
    const delta = computeDelta(currentSnapshot, previousSnapshot);

    // Step 5: Create Notion meeting note
    let notionPageId: string | null = null;
    try {
      notionPageId = await createWeeklySyncPage(
        currentSnapshot.github,
        currentSnapshot.contextSync,
        okr,
        delta
      );
    } catch (error) {
      console.error("Failed to create Notion page:", error);
    }

    const notionPageUrl = notionPageId
      ? `https://notion.so/${notionPageId.replace(/-/g, "")}`
      : null;

    // Step 6: Send Slack messages
    try {
      await sendChannelSummary(
        currentSnapshot.github,
        currentSnapshot.contextSync,
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
        currentSnapshot.github,
        currentSnapshot.contextSync,
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
        totalMerged: currentSnapshot.github.totalMerged,
        totalOpen: currentSnapshot.github.totalOpen,
        totalCommits: currentSnapshot.github.totalCommits,
      },
      contextSync: {
        sessions: currentSnapshot.contextSync.totalSessions,
      },
      okr: {
        objectives: okr.objectives.length,
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
