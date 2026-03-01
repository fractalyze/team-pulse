// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { collectGitHubMetrics } from "@/lib/collectors/github";
import { collectKnowledgeMetrics } from "@/lib/collectors/knowledge";
import { collectContextSyncMetrics } from "@/lib/collectors/notion";
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
  try {
    const body = await request.json();
    if (body.actions && Array.isArray(body.actions)) {
      actions = body.actions;
    }
  } catch {
    // Use default actions
  }

  const weekId = getWeekId();
  const results: Record<string, unknown> = { weekId };

  try {
    // Always collect
    const [github, knowledge, contextSync] = await Promise.all([
      collectGitHubMetrics(weekId),
      collectKnowledgeMetrics(weekId),
      collectContextSyncMetrics(weekId),
    ]);

    const previousWeekId = getPreviousWeekId(weekId);
    const previousSnapshot = await getSnapshot(previousWeekId);
    const currentSnapshot = assembleSnapshot(
      weekId,
      github,
      knowledge,
      contextSync
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
      },
      knowledge: {
        created: knowledge.totalCreated,
        updated: knowledge.totalUpdated,
      },
      contextSync: { sessions: contextSync.totalSessions },
      delta,
    };

    if (actions.includes("notion")) {
      const pageId = await createWeeklySyncPage(
        github,
        knowledge,
        contextSync,
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
        knowledge,
        contextSync,
        delta,
        notionPageUrl
      );
      results.slack = "sent";
    }

    if (actions.includes("dm")) {
      const weekLabel = `${formatDateKST(new Date())} 주차`;
      await sendIndividualDMs(github, knowledge, weekLabel);
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
