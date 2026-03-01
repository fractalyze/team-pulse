// Copyright 2026 Fractalyze Inc. All rights reserved.

import { WebClient } from "@slack/web-api";
import { TEAM, SLACK_CHANNEL, DASHBOARD_URL } from "../config";
import { formatDateKST } from "../week";
import type {
  GitHubMetrics,
  KnowledgeMetrics,
  ContextSyncMetrics,
  OKRMetrics,
  WeeklyDelta,
} from "../types";

// Slack Block Kit types
interface Block {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text: string }>;
  fields?: Array<{ type: string; text: string }>;
  accessory?: object;
}

function getSlackClient(): WebClient {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  return new WebClient(token);
}

function header(text: string): Block {
  return {
    type: "header",
    text: { type: "plain_text", text, emoji: true },
  };
}

function section(text: string): Block {
  return {
    type: "section",
    text: { type: "mrkdwn", text },
  };
}

function dividerBlock(): Block {
  return { type: "divider" };
}

function context(text: string): Block {
  return {
    type: "context",
    elements: [{ type: "mrkdwn", text }],
  };
}

/** Build channel summary with ACTION NEEDED + MEETING PREP structure. */
export function buildChannelSummary(
  github: GitHubMetrics,
  knowledge: KnowledgeMetrics,
  contextSync: ContextSyncMetrics,
  okr: OKRMetrics,
  delta: WeeklyDelta | null,
  notionPageUrl: string | null
): Block[] {
  const today = new Date();
  const blocks: Block[] = [];

  // Header with key stats
  blocks.push(header(`📊 Weekly Team Pulse - ${formatDateKST(today)}`));

  const mergedDelta =
    delta !== null
      ? ` (${delta.prsMergedDelta >= 0 ? "+" : ""}${delta.prsMergedDelta})`
      : "";
  blocks.push(
    section(
      `This Week: *${github.totalMerged} PRs${mergedDelta}* | *${github.totalCommits} commits* | *${knowledge.totalCreated} knowledge*`
    )
  );

  blocks.push(dividerBlock());

  // --- ACTION NEEDED ---
  blocks.push(section("*--- ACTION NEEDED ---*"));

  // Review queue: PRs waiting > 2 days
  const longWaitPRs = github.repos
    .flatMap((r) => r.open)
    .filter((pr) => {
      const daysOpen = Math.floor(
        (Date.now() - new Date(pr.createdAt).getTime()) / 86400000
      );
      return daysOpen >= 2;
    })
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  if (longWaitPRs.length > 0) {
    let reviewText = `*Review Queue (${longWaitPRs.length} PRs > 2일):*\n`;
    for (const pr of longWaitPRs.slice(0, 5)) {
      const daysOpen = Math.floor(
        (Date.now() - new Date(pr.createdAt).getTime()) / 86400000
      );
      const reviewers =
        pr.reviewers.length > 0
          ? ` @${pr.reviewers.join(", @")}`
          : " (리뷰어 없음)";
      reviewText += `  <${pr.url}|${pr.repo}#${pr.number}> ${daysOpen}일${reviewers}\n`;
    }
    blocks.push(section(reviewText));
  } else {
    blocks.push(section("*Review Queue:* 모든 PR이 최신 상태"));
  }

  // Pending action items
  const pendingActions = contextSync.notes.flatMap((n) =>
    n.actionItems
      .filter((a) => !a.done)
      .map((a) => ({ ...a, noteTitle: n.title }))
  );
  if (pendingActions.length > 0) {
    let actionText = `*Pending Actions (${pendingActions.length}건):*\n`;
    for (const action of pendingActions.slice(0, 5)) {
      const assignee = action.assignee ? `@${action.assignee}` : "";
      actionText += `  ${assignee}: ${action.text}\n`;
    }
    blocks.push(section(actionText));
  }

  blocks.push(dividerBlock());

  // --- MEETING PREP ---
  blocks.push(section("*--- MEETING PREP ---*"));

  const prepLines: string[] = [];
  if (notionPageUrl) {
    prepLines.push(`📋 Notion 준비됨: <${notionPageUrl}|열기>`);
  }

  // Hard deadline warning
  if (okr.nextHardDeadline) {
    prepLines.push(
      `⚠️ HARD deadline: ${okr.nextHardDeadline.month} ${okr.nextHardDeadline.week} week - ${okr.nextHardDeadline.content}`
    );
  }

  // This week's goal
  if (okr.thisWeekGoal) {
    prepLines.push(
      `📅 이번 주 목표: ${okr.thisWeekGoal.content}`
    );
  }

  if (prepLines.length > 0) {
    blocks.push(section(prepLines.join("\n")));
  }

  // Footer
  blocks.push(dividerBlock());
  const links: string[] = [];
  if (notionPageUrl) links.push(`📋 <${notionPageUrl}|Notion>`);
  links.push(`📈 <${DASHBOARD_URL}/week/${github.weekId}|Dashboard>`);
  blocks.push(context(links.join(" | ")));

  return blocks;
}

/** Build individual DM with YOUR WEEK + PREP structure. */
export function buildIndividualDM(
  memberName: string,
  github: GitHubMetrics,
  knowledge: KnowledgeMetrics,
  contextSync: ContextSyncMetrics,
  weekLabel: string,
  notionPageUrl: string | null
): Block[] {
  const member = TEAM.find((m) => m.name === memberName);
  if (!member) return [];

  const blocks: Block[] = [];
  blocks.push(header(`🔔 [${memberName}] Prep - ${weekLabel}`));
  blocks.push(dividerBlock());

  // YOUR WEEK summary
  if (member.github !== "TBD") {
    const mergedPRs = github.repos.flatMap((r) =>
      r.merged.filter((pr) => pr.author === member.github)
    );
    const openPRs = github.repos.flatMap((r) =>
      r.open.filter((pr) => pr.author === member.github)
    );
    const reviewCount =
      github.reviewHealth.byReviewer[member.github] ?? 0;

    blocks.push(
      section(
        `*YOUR WEEK:* ${mergedPRs.length} merged, ${reviewCount} reviewed, ${openPRs.length} open`
      )
    );

    // Merged PRs details
    if (mergedPRs.length > 0) {
      let prText = mergedPRs
        .map(
          (pr) =>
            `• ✅ <${pr.url}|#${pr.number} ${pr.repo}> - ${pr.title}`
        )
        .join("\n");
      blocks.push(section(prText));
    }

    // Open PRs with wait time
    if (openPRs.length > 0) {
      let openText = openPRs
        .map((pr) => {
          const daysOpen = Math.floor(
            (Date.now() - new Date(pr.createdAt).getTime()) / 86400000
          );
          return `• ⏳ <${pr.url}|#${pr.number} ${pr.repo}> (${daysOpen}일)`;
        })
        .join("\n");
      blocks.push(section(openText));
    }
  }

  // PREP: pending action items for this member
  const memberActions = contextSync.notes.flatMap((n) =>
    n.actionItems.filter(
      (a) =>
        !a.done &&
        a.assignee.toLowerCase() === memberName.toLowerCase()
    )
  );
  if (memberActions.length > 0) {
    let actionText = `*미완료 actions:*\n`;
    actionText += memberActions
      .map((a) => `• ${a.text}`)
      .join("\n");
    blocks.push(section(actionText));
  }

  // Prep links
  blocks.push(dividerBlock());
  const prepLines: string[] = [];
  if (notionPageUrl) {
    prepLines.push(
      `📋 PREP: Notion에 "next week" 입력 <${notionPageUrl}|열기>`
    );
  }
  prepLines.push("📋 오늘 Weekly Sync 17:00 KST");
  blocks.push(context(prepLines.join("\n")));

  return blocks;
}

/** Send channel summary to Slack. */
export async function sendChannelSummary(
  github: GitHubMetrics,
  knowledge: KnowledgeMetrics,
  contextSync: ContextSyncMetrics,
  okr: OKRMetrics,
  delta: WeeklyDelta | null,
  notionPageUrl: string | null
): Promise<void> {
  if (!SLACK_CHANNEL) {
    console.warn("SLACK_CHANNEL_ID not set, skipping channel message");
    return;
  }

  const client = getSlackClient();
  const blocks = buildChannelSummary(
    github,
    knowledge,
    contextSync,
    okr,
    delta,
    notionPageUrl
  );

  await client.chat.postMessage({
    channel: SLACK_CHANNEL,
    blocks: blocks as never[],
    text: `📊 Weekly Team Pulse - ${formatDateKST(new Date())}`,
  });
}

/** Send individual DMs to team members. */
export async function sendIndividualDMs(
  github: GitHubMetrics,
  knowledge: KnowledgeMetrics,
  contextSync: ContextSyncMetrics,
  weekLabel: string,
  notionPageUrl: string | null
): Promise<void> {
  const client = getSlackClient();

  for (const member of TEAM) {
    if (member.slack === "TBD") continue;

    try {
      const blocks = buildIndividualDM(
        member.name,
        github,
        knowledge,
        contextSync,
        weekLabel,
        notionPageUrl
      );
      if (blocks.length === 0) continue;

      // Open DM channel
      const dm = await client.conversations.open({ users: member.slack });
      if (!dm.channel?.id) continue;

      await client.chat.postMessage({
        channel: dm.channel.id,
        blocks: blocks as never[],
        text: `🔔 [${member.name}] Weekly Pulse - ${weekLabel}`,
      });
    } catch (error) {
      console.warn(`Failed to send DM to ${member.name}:`, error);
    }
  }
}
