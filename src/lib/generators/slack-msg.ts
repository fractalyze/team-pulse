// Copyright 2026 Fractalyze Inc. All rights reserved.

import { WebClient } from "@slack/web-api";
import { TEAM, SLACK_CHANNEL, DASHBOARD_URL } from "../config";
import { formatDateKST, getWeekRange } from "../week";
import type {
  GitHubMetrics,
  KnowledgeMetrics,
  ContextSyncMetrics,
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

function divider(): Block {
  return { type: "divider" };
}

function context(text: string): Block {
  return {
    type: "context",
    elements: [{ type: "mrkdwn", text }],
  };
}

/** Build channel summary message blocks. */
export function buildChannelSummary(
  github: GitHubMetrics,
  knowledge: KnowledgeMetrics,
  contextSync: ContextSyncMetrics,
  delta: WeeklyDelta | null,
  notionPageUrl: string | null
): Block[] {
  const today = new Date();
  const blocks: Block[] = [];

  blocks.push(header(`📊 Weekly Team Pulse - ${formatDateKST(today)}`));
  blocks.push(divider());

  // GitHub Activity
  const mergedDelta =
    delta !== null
      ? ` (${delta.prsMergedDelta >= 0 ? "+" : ""}${delta.prsMergedDelta})`
      : "";
  const repoCount = github.repos.filter((r) => r.totalMerged > 0).length;
  const avgDays =
    github.avgLeadTimeDays !== null
      ? `${github.avgLeadTimeDays} days`
      : "N/A";
  blocks.push(
    section(
      `*GitHub Activity*\n` +
        `• PRs Merged: ${github.totalMerged}${mergedDelta} across ${repoCount} repos\n` +
        `• PRs Open: ${github.totalOpen} (avg lead time: ${avgDays})`
    )
  );

  // Knowledge Growth
  const kgDelta =
    delta !== null
      ? ` (${delta.knowledgeCreatedDelta >= 0 ? "+" : ""}${delta.knowledgeCreatedDelta})`
      : "";
  const newNames = knowledge.newEntries
    .map((e) => e.name)
    .slice(0, 3)
    .join(", ");
  blocks.push(
    section(
      `*Knowledge Growth*\n` +
        `• 🆕 ${knowledge.totalCreated} new articles${kgDelta} | 🔄 ${knowledge.totalUpdated} updated\n` +
        (newNames ? `• ${newNames}` : "")
    )
  );

  // Context Sync
  if (contextSync.notes.length > 0) {
    const { start } = getWeekRange(contextSync.weekId);
    const lines = contextSync.notes
      .map((n) => {
        const dayLabel = formatDateKST(n.date);
        const topics = n.topics.slice(0, 2).join(", ") || n.title;
        return `• ${dayLabel}: ${topics}`;
      })
      .join("\n");
    blocks.push(section(`*Context Sync 이번 주 주제*\n${lines}`));
  }

  // Mission Alignment
  const objEntries = Object.entries(github.byObjective)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (objEntries.length > 0) {
    const objLines = objEntries
      .map(([obj, count]) => {
        const repos = github.repos
          .filter(
            (r) => r.totalMerged > 0 && github.byObjective[obj] !== undefined
          )
          .map((r) => r.repo)
          .slice(0, 3)
          .join(", ");
        return `• ${obj}: PR ${count}건 (${repos})`;
      })
      .join("\n");
    blocks.push(section(`*Mission Alignment*\n${objLines}`));
  }

  // Footer
  blocks.push(divider());
  const links: string[] = [];
  if (notionPageUrl) links.push(`📋 <${notionPageUrl}|Notion>`);
  links.push(`📈 <${DASHBOARD_URL}/week/${github.weekId}|Dashboard>`);
  blocks.push(context(links.join(" | ")));

  return blocks;
}

/** Build individual DM message blocks. */
export function buildIndividualDM(
  memberName: string,
  github: GitHubMetrics,
  knowledge: KnowledgeMetrics,
  weekLabel: string
): Block[] {
  const member = TEAM.find((m) => m.name === memberName);
  if (!member) return [];

  const blocks: Block[] = [];
  blocks.push(header(`🔔 [${memberName}] Weekly Pulse - ${weekLabel}`));
  blocks.push(divider());

  // Find member's PRs
  if (member.github !== "TBD") {
    const mergedPRs = github.repos.flatMap((r) =>
      r.merged.filter((pr) => pr.author === member.github)
    );
    const openPRs = github.repos.flatMap((r) =>
      r.open.filter((pr) => pr.author === member.github)
    );

    let prText = "*Your PRs*\n";
    if (mergedPRs.length > 0) {
      prText += mergedPRs
        .map(
          (pr) =>
            `• ✅ Merged: <${pr.url}|#${pr.number} ${pr.repo}> - ${pr.title}`
        )
        .join("\n");
      prText += "\n";
    }
    if (openPRs.length > 0) {
      prText += openPRs
        .map((pr) => {
          const daysOpen = Math.floor(
            (Date.now() - new Date(pr.createdAt).getTime()) / 86400000
          );
          const reviewers =
            pr.reviewers.length > 0
              ? `, ${pr.reviewers.length} reviewer pending`
              : "";
          return `• ⏳ Open: <${pr.url}|#${pr.number} ${pr.repo}> (${daysOpen} days${reviewers})`;
        })
        .join("\n");
    }
    if (mergedPRs.length === 0 && openPRs.length === 0) {
      prText += "• No PRs this week";
    }
    blocks.push(section(prText));
  }

  // Knowledge contributions
  const memberKnowledge = knowledge.newEntries.filter(
    (e) => e.linkedPR !== null
  );
  if (memberKnowledge.length > 0) {
    blocks.push(
      section(
        `*이번 주 Knowledge*\n` +
          memberKnowledge
            .map((e) => `• 🆕 작성: ${e.name}`)
            .slice(0, 5)
            .join("\n")
      )
    );
  }

  blocks.push(divider());
  blocks.push(context("📋 오늘 Weekly Sync 17:00 KST"));

  return blocks;
}

/** Send channel summary to Slack. */
export async function sendChannelSummary(
  github: GitHubMetrics,
  knowledge: KnowledgeMetrics,
  contextSync: ContextSyncMetrics,
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
  weekLabel: string
): Promise<void> {
  const client = getSlackClient();

  for (const member of TEAM) {
    if (member.slack === "TBD") continue;

    try {
      const blocks = buildIndividualDM(
        member.name,
        github,
        knowledge,
        weekLabel
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
