// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { collectGitHubMetrics } from "@/lib/collectors/github";
import { collectContextSyncMetrics } from "@/lib/collectors/notion";
import { collectOKRMetrics } from "@/lib/collectors/okr";
import { createWeeklySyncPage } from "@/lib/generators/notion-page";
import {
  sendChannelSummary,
  sendIndividualDMs,
} from "@/lib/generators/slack-msg";
import { assembleSnapshot, computeDelta } from "@/lib/generators/metrics";
import { saveSnapshot, getSnapshot } from "@/lib/store/kv";
import { getWeekId, getPreviousWeekId, formatDateKST } from "@/lib/week";

/**
 * Manual trigger for testing. POST /api/trigger
 * Body: { "actions": ["collect", "notion", "slack", "dm"] }
 * If no body, runs all actions.
 */
export async function POST(request: Request) {
  // Simple auth check
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let actions: string[] = ["collect", "notion", "slack", "dm"];
  let weekId = getWeekId();
  try {
    const body = await request.json();
    if (body.actions && Array.isArray(body.actions)) {
      actions = body.actions;
    }
    if (body.weekId && typeof body.weekId === "string") {
      weekId = body.weekId;
    }
  } catch {
    // Use default actions
  }
  const results: Record<string, unknown> = { weekId };

  try {
    const [github, contextSync] = await Promise.all([
      collectGitHubMetrics(weekId),
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

    const previousWeekId = getPreviousWeekId(weekId);
    const previousSnapshot = await getSnapshot(previousWeekId);
    const currentSnapshot = assembleSnapshot(
      weekId,
      github,
      contextSync,
      okr
    );
    const delta = computeDelta(currentSnapshot, previousSnapshot);

    if (actions.includes("collect")) {
      await saveSnapshot(currentSnapshot);
      results.collect = "saved";
    }

    results.metrics = {
      github: {
        totalMerged: github.totalMerged,
        totalOpen: github.totalOpen,
        totalCommits: github.totalCommits,
      },
      contextSync: { sessions: contextSync.totalSessions },
      okr: { objectives: okr.objectives.length },
      delta,
    };

    if (actions.includes("notion")) {
      const pageId = await createWeeklySyncPage(
        github,
        contextSync,
        okr,
        delta
      );
      results.notion = {
        pageId,
        url: `https://notion.so/${pageId.replace(/-/g, "")}`,
      };
    }

    const notionPageUrl =
      results.notion &&
      typeof results.notion === "object" &&
      "url" in results.notion
        ? (results.notion as { url: string }).url
        : null;

    if (actions.includes("slack")) {
      await sendChannelSummary(
        github,
        contextSync,
        okr,
        delta,
        notionPageUrl
      );
      results.slack = "sent";
    }

    if (actions.includes("dm")) {
      const weekLabel = `${formatDateKST(new Date())} 주차`;
      await sendIndividualDMs(
        github,
        contextSync,
        weekLabel,
        notionPageUrl
      );
      results.dm = "sent";
    }

    return NextResponse.json({ status: "success", ...results });
  } catch (error) {
    console.error("Manual trigger failed:", error);
    return NextResponse.json(
      { error: "Failed", details: String(error) },
      { status: 500 }
    );
  }
}
