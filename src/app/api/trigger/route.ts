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
import { getTeam } from "@/lib/team";

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

  // Debug: test GitHub org API + Slack users directly
  if (actions.includes("test-team")) {
    const { Octokit } = await import("@octokit/rest");
    const { WebClient } = await import("@slack/web-api");
    const debug: Record<string, unknown> = {};
    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const { data: user } = await octokit.users.getAuthenticated();
      debug.githubUser = user.login;
      debug.tokenScopes = "authenticated";
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
        .map((u) => ({ name: u.real_name, email: u.profile?.email, id: u.id }));
    } catch (e) {
      debug.slackError = String(e);
    }
    return NextResponse.json({ debug });
  }

  // Debug: test DM to a specific Slack user
  if (actions.includes("test-dm")) {
    const { WebClient } = await import("@slack/web-api");
    const client = new WebClient(process.env.SLACK_BOT_TOKEN);
    const testUserId = "U09S3S19N1L"; // Ryan Kim
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

  // Debug: test Google Calendar
  if (actions.includes("test-gcal")) {
    const { hasWeeklySyncToday } = await import("@/lib/collectors/gcal");
    try {
      const hasEvent = await hasWeeklySyncToday();
      return NextResponse.json({ gcal: { hasWeeklySyncToday: hasEvent } });
    } catch (e) {
      return NextResponse.json({ gcal: { error: String(e) } });
    }
  }

  try {
    // Auto-discover team from GitHub org + Slack
    const team = await getTeam();

    const [github, contextSync] = await Promise.all([
      collectGitHubMetrics(weekId, team),
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
      okr,
      team
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
