// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { collectGitHubMetrics } from "@/lib/collectors/github";
import { collectContextSyncMetrics } from "@/lib/collectors/notion";
import { assembleSnapshot, computeDelta } from "@/lib/generators/metrics";
import { saveSnapshot, getSnapshot } from "@/lib/store/kv";
import { getWeekId, getPreviousWeekId } from "@/lib/week";
import { getTeam } from "@/lib/team";
import type { WeeklySnapshot } from "@/lib/types";

/**
 * Manual trigger for testing. POST /api/trigger
 * Body: { "actions": [...], "weekId": "2026-W10" }
 *
 * Actions:
 *   Test:    test-team
 *   Collect: collect-github, collect-notion
 *   Save:    save-github, save-notion
 *   Full:    collect (collect all + save)
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let actions: string[] = ["collect"];
  let weekId = getWeekId();
  try {
    const requestBody = await request.json();
    if (requestBody.actions && Array.isArray(requestBody.actions)) {
      actions = requestBody.actions;
    }
    if (requestBody.weekId && typeof requestBody.weekId === "string") {
      weekId = requestBody.weekId;
    }
  } catch {
    // Use default actions
  }

  // --- Test actions (return immediately) ---

  if (actions.includes("test-team")) {
    const { Octokit } = await import("@octokit/rest");
    const debug: Record<string, unknown> = {};
    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const { data: user } = await octokit.users.getAuthenticated();
      debug.githubUser = user.login;
    } catch (e) {
      debug.githubAuth = String(e);
    }
    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const { data: members } = await octokit.orgs.listMembers({
        org: "fractalyze",
        per_page: 100,
      });
      debug.orgMembers = members.map((m: { login: string }) => m.login);
    } catch (e) {
      debug.orgError = String(e);
    }
    return NextResponse.json({ debug });
  }

  // --- Individual collect (preview only) ---

  if (actions.includes("collect-github")) {
    try {
      const team = await getTeam();
      const github = await collectGitHubMetrics(weekId, team);
      return NextResponse.json({
        status: "success",
        source: "github",
        weekId,
        data: {
          totalMerged: github.totalMerged,
          totalOpen: github.totalOpen,
          totalCommits: github.totalCommits,
          repos: github.repos.map((r) => ({
            name: r.repo,
            merged: r.merged.length,
            open: r.open.length,
          })),
          reviewHealth: {
            avgReviewLatencyHours: github.reviewHealth.avgReviewLatencyHours,
            avgLeadTimeHours: github.reviewHealth.avgLeadTimeHours,
            prsWithNoReview: github.reviewHealth.prsWithNoReview,
            missedReviews: github.reviewHealth.missedReviews.length,
          },
          byAuthor: github.byAuthor,
        },
      });
    } catch (e) {
      return NextResponse.json(
        { source: "github", error: String(e) },
        { status: 500 }
      );
    }
  }

  if (actions.includes("collect-notion")) {
    try {
      const contextSync = await collectContextSyncMetrics(weekId);
      return NextResponse.json({
        status: "success",
        source: "notion",
        weekId,
        data: {
          totalSessions: contextSync.totalSessions,
          notes: contextSync.notes.map((n) => ({
            title: n.title,
            date: n.date,
            actionItems: n.actionItems.length,
          })),
          actionItems: {
            total: contextSync.notes.reduce(
              (sum, n) => sum + n.actionItems.length,
              0
            ),
            done: contextSync.notes.reduce(
              (sum, n) => sum + n.actionItems.filter((a) => a.done).length,
              0
            ),
          },
        },
      });
    } catch (e) {
      return NextResponse.json(
        { source: "notion", error: String(e) },
        { status: 500 }
      );
    }
  }

  // --- Individual save (collect + merge into existing snapshot) ---

  if (actions.includes("save-github")) {
    try {
      const team = await getTeam();
      const github = await collectGitHubMetrics(weekId, team);
      const existing = await getSnapshot(weekId);
      const snapshot: WeeklySnapshot = {
        ...(existing ?? {
          weekId,
          contextSync: { weekId, totalSessions: 0, totalTopics: 0, totalActionItems: 0, pendingActionItems: 0, notes: [] },
          okr: {
            weekId,
            objectives: [],
            thisWeekGoal: null,
            nextHardDeadline: null,
          },
        }),
        weekId,
        collectedAt: new Date().toISOString(),
        github,
      };
      await saveSnapshot(snapshot);
      return NextResponse.json({
        status: "saved",
        source: "github",
        weekId,
        totalMerged: github.totalMerged,
        totalOpen: github.totalOpen,
        totalCommits: github.totalCommits,
      });
    } catch (e) {
      return NextResponse.json(
        { source: "github", error: String(e) },
        { status: 500 }
      );
    }
  }

  if (actions.includes("save-notion")) {
    try {
      const contextSync = await collectContextSyncMetrics(weekId);
      const existing = await getSnapshot(weekId);
      if (!existing) {
        return NextResponse.json(
          {
            source: "notion",
            error: "No existing snapshot. Run Save GitHub first.",
          },
          { status: 400 }
        );
      }
      const snapshot: WeeklySnapshot = {
        ...existing,
        collectedAt: new Date().toISOString(),
        contextSync,
      };
      await saveSnapshot(snapshot);
      return NextResponse.json({
        status: "saved",
        source: "notion",
        weekId,
        totalSessions: contextSync.totalSessions,
      });
    } catch (e) {
      return NextResponse.json(
        { source: "notion", error: String(e) },
        { status: 500 }
      );
    }
  }

  // --- Full pipeline (collect all + save) ---

  const results: Record<string, unknown> = { weekId };

  try {
    const team = await getTeam();

    const [github, contextSync] = await Promise.all([
      collectGitHubMetrics(weekId, team),
      collectContextSyncMetrics(weekId),
    ]);

    const okr = {
      weekId,
      objectives: [],
      thisWeekGoal: null,
      nextHardDeadline: null,
    };

    const previousWeekId = getPreviousWeekId(weekId);
    const previousSnapshot = await getSnapshot(previousWeekId);
    const currentSnapshot = assembleSnapshot(
      weekId,
      github,
      contextSync,
      okr,
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
    results.team = team.map((m) => ({
      name: m.name,
      github: m.github,
    }));

    return NextResponse.json({ status: "success", ...results });
  } catch (error) {
    console.error("Manual trigger failed:", error);
    return NextResponse.json(
      { error: "Failed", details: String(error) },
      { status: 500 }
    );
  }
}
