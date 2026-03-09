// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { collectGitHubMetrics, collectMilestoneMetadata } from "@/lib/collectors/github";
import { collectContextSyncMetrics } from "@/lib/collectors/notion";
import { createWeeklySyncPage } from "@/lib/generators/notion-page";
import {
  sendChannelSummary,
  sendIndividualDMs,
} from "@/lib/generators/slack-msg";
import { assembleSnapshot, computeDelta, buildCrossRepoMilestones } from "@/lib/generators/metrics";
import { saveSnapshot, getSnapshot } from "@/lib/store/kv";
import { getWeekId, getPreviousWeekId, formatDateKST } from "@/lib/week";
import { getTeam } from "@/lib/team";
import type { WeeklySnapshot } from "@/lib/types";

/**
 * Manual trigger for testing. POST /api/trigger
 * Body: { "actions": [...], "weekId": "2026-W10" }
 *
 * Actions:
 *   Test:    test-team, test-gcal, test-dm
 *   Collect: collect-github, collect-notion, collect-okr
 *   Save:    save-github, save-notion, save-okr
 *   Full:    collect (collect all + save), notion, slack, dm
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let actions: string[] = ["collect", "notion", "slack", "dm"];
  let weekId = getWeekId();
  let requestBody: Record<string, unknown> = {};
  try {
    requestBody = await request.json();
    if (requestBody.actions && Array.isArray(requestBody.actions)) {
      actions = requestBody.actions;
    }
    if (requestBody.weekId && typeof requestBody.weekId === "string") {
      weekId = requestBody.weekId;
    }
  } catch {
    // Use default actions
  }

  // --- OTel user management ---

  if (actions.includes("delete-otel-user")) {
    const { deleteOtelUser } = await import("@/lib/store/claude-code");
    const email = requestBody.email as string;
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }
    try {
      const deleted = await deleteOtelUser(email);
      return NextResponse.json({ status: "success", deleted, email });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // --- Test actions (return immediately) ---

  if (actions.includes("test-team")) {
    const { Octokit } = await import("@octokit/rest");
    const { WebClient } = await import("@slack/web-api");
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
    try {
      const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
      const res = await slack.users.list({ limit: 10 });
      debug.slackUsers = (res.members ?? [])
        .filter((u) => !u.deleted && !u.is_bot && u.id !== "USLACKBOT")
        .map((u) => ({
          name: u.real_name,
          email: u.profile?.email,
          id: u.id,
        }));
    } catch (e) {
      debug.slackError = String(e);
    }
    return NextResponse.json({ debug });
  }

  if (actions.includes("test-dm")) {
    const { WebClient } = await import("@slack/web-api");
    const client = new WebClient(process.env.SLACK_BOT_TOKEN);
    const testUserId = "U09S3S19N1L";
    try {
      const dm = await client.conversations.open({ users: testUserId });
      if (!dm.channel?.id) {
        return NextResponse.json({ error: "Failed to open DM channel" });
      }
      await client.chat.postMessage({
        channel: dm.channel.id,
        text: "🔔 Team Pulse DM 테스트 - 정상 작동 확인!",
      });
      return NextResponse.json({ status: "dm_sent", channel: dm.channel.id });
    } catch (e) {
      return NextResponse.json({ error: String(e) });
    }
  }

  if (actions.includes("test-gcal")) {
    const { hasWeeklySyncToday } = await import("@/lib/collectors/gcal");
    try {
      const hasEvent = await hasWeeklySyncToday();
      return NextResponse.json({ gcal: { hasWeeklySyncToday: hasEvent } });
    } catch (e) {
      return NextResponse.json({ gcal: { error: String(e) } });
    }
  }

  // --- Individual collect (preview only) ---

  if (actions.includes("collect-github")) {
    try {
      const team = await getTeam();
      const [github, milestonesMeta] = await Promise.all([
        collectGitHubMetrics(weekId, team),
        collectMilestoneMetadata(),
      ]);
      const crossRepoMilestones = buildCrossRepoMilestones(github, milestonesMeta);
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
          milestones: crossRepoMilestones.map((m) => ({
            title: m.title,
            dueOn: m.dueOn,
            repos: m.repos.length,
            mergedCount: m.mergedCount,
            openCount: m.openCount,
            draftCount: m.draftCount,
          })),
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


  if (actions.includes("collect-milestones")) {
    try {
      const milestonesMeta = await collectMilestoneMetadata();
      return NextResponse.json({
        status: "success",
        source: "milestones",
        data: {
          count: milestonesMeta.length,
          milestones: milestonesMeta.map((m) => ({
            title: m.title,
            dueOn: m.dueOn,
            repos: m.repos,
          })),
        },
      });
    } catch (e) {
      return NextResponse.json(
        { source: "milestones", error: String(e) },
        { status: 500 }
      );
    }
  }

  // --- Individual save (collect + merge into existing snapshot) ---

  if (actions.includes("save-github")) {
    try {
      const team = await getTeam();
      const [github, milestonesMeta] = await Promise.all([
        collectGitHubMetrics(weekId, team),
        collectMilestoneMetadata(),
      ]);
      const crossRepoMilestones = buildCrossRepoMilestones(github, milestonesMeta);
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
        crossRepoMilestones,
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


  // --- Full pipeline (collect all + save + outputs) ---

  const results: Record<string, unknown> = { weekId };

  try {
    const team = await getTeam();

    const [github, contextSync, milestonesMeta] = await Promise.all([
      collectGitHubMetrics(weekId, team),
      collectContextSyncMetrics(weekId),
      collectMilestoneMetadata(),
    ]);

    const crossRepoMilestones = buildCrossRepoMilestones(github, milestonesMeta);

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
      crossRepoMilestones,
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
      slack: m.slack !== "TBD" ? "linked" : "TBD",
    }));

    if (actions.includes("notion")) {
      const pageId = await createWeeklySyncPage(
        github,
        contextSync,
        okr,
        delta,
        team
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
        notionPageUrl,
        team
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
