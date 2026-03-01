// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Client } from "@notionhq/client";
import { CONTEXT_SYNC_DB, DASHBOARD_URL, TEAM } from "../config";
import { formatDateKST } from "../week";
import type {
  GitHubMetrics,
  KnowledgeMetrics,
  ContextSyncMetrics,
  WeeklyDelta,
} from "../types";

type BlockObjectRequest = Parameters<
  Client["blocks"]["children"]["append"]
>[0]["children"][number];

function getNotionClient(): Client {
  const token = process.env.NOTION_API_KEY;
  if (!token) throw new Error("NOTION_API_KEY is not set");
  return new Client({ auth: token });
}

function heading2(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

function heading3(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "heading_3",
    heading_3: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

function paragraph(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

function bulletItem(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

function divider(): BlockObjectRequest {
  return { object: "block", type: "divider", divider: {} };
}

function callout(text: string, emoji: string = "📊"): BlockObjectRequest {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: [{ type: "text", text: { content: text } }],
      icon: { type: "emoji", emoji: emoji as "📊" },
    },
  };
}

/** Build milestone section for a team member. */
function buildMemberMilestone(
  name: string,
  github: GitHubMetrics
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];
  blocks.push(bulletItem(`${name}: next week → [수동 입력]`));

  // Find merged PRs by this member
  const memberPRs = github.repos.flatMap((r) =>
    r.merged.filter((pr) => {
      const member = TEAM.find((m) => m.name === name);
      return member && member.github !== "TBD" && pr.author === member.github;
    })
  );

  if (memberPRs.length > 0) {
    blocks.push(
      bulletItem(
        `  achieve: ${memberPRs.map((pr) => `PR#${pr.number} ${pr.repo}: ${pr.title} (merged ${formatDateKST(pr.mergedAt!)})`).join(", ")}`
      )
    );
  } else {
    blocks.push(bulletItem("  achieve: [수동 입력]"));
  }
  blocks.push(bulletItem("  blocking point: [수동 입력]"));
  blocks.push(bulletItem("  achievable?: [수동 입력]"));

  return blocks;
}

/** Build the weekly retro section with auto-filled data. */
function buildRetroSection(
  github: GitHubMetrics,
  knowledge: KnowledgeMetrics,
  contextSync: ContextSyncMetrics,
  delta: WeeklyDelta | null
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  blocks.push(heading3("1) Last week check"));

  const mergedDelta = delta
    ? ` (${delta.prsMergedDelta >= 0 ? "+" : ""}${delta.prsMergedDelta} vs last week)`
    : "";
  const repoCount = github.repos.filter((r) => r.totalMerged > 0).length;
  blocks.push(
    bulletItem(
      `PRs Merged: ${github.totalMerged} across ${repoCount} repos${mergedDelta}`
    )
  );

  const kgDelta = delta
    ? ` (${delta.knowledgeCreatedDelta >= 0 ? "+" : ""}${delta.knowledgeCreatedDelta})`
    : "";
  blocks.push(
    bulletItem(
      `Knowledge Growth: ${knowledge.totalCreated} new, ${knowledge.totalUpdated} updated${kgDelta}`
    )
  );

  const topicSummary = contextSync.notes
    .flatMap((n) => n.topics.slice(0, 2))
    .join(", ");
  blocks.push(bulletItem(`Context Sync Topics: ${topicSummary || "N/A"}`));

  blocks.push(heading3("2) What happened/Topic raised"));
  blocks.push(paragraph("[수동 입력]"));
  blocks.push(heading3("3) ONE focus"));
  blocks.push(paragraph("[수동 입력]"));
  blocks.push(heading3("4) Next week change"));
  blocks.push(paragraph("[수동 입력]"));

  return blocks;
}

/** Build Context Sync summary table section. */
function buildContextSyncSection(
  contextSync: ContextSyncMetrics
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];
  blocks.push(heading3("이번 주 Context Sync 요약"));

  if (contextSync.notes.length === 0) {
    blocks.push(paragraph("이번 주 Context Sync 세션 없음"));
    return blocks;
  }

  for (const note of contextSync.notes) {
    const topics = note.topics.slice(0, 3).join(", ") || "N/A";
    const insights = note.keyInsights[0] || "-";
    blocks.push(
      bulletItem(`${formatDateKST(note.date)} | ${topics} | ${insights}`)
    );
  }

  return blocks;
}

/** Build Knowledge Graph update section. */
function buildKnowledgeSection(
  knowledge: KnowledgeMetrics
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];
  blocks.push(heading3("이번 주 Knowledge Graph 업데이트"));

  if (
    knowledge.newEntries.length === 0 &&
    knowledge.updatedEntries.length === 0
  ) {
    blocks.push(paragraph("이번 주 Knowledge 업데이트 없음"));
    return blocks;
  }

  for (const entry of knowledge.newEntries) {
    const prRef = entry.linkedPR ? ` (${entry.linkedPR})` : "";
    blocks.push(bulletItem(`🆕 ${entry.name}${prRef}`));
  }
  for (const entry of knowledge.updatedEntries) {
    const prRef = entry.linkedPR ? ` (${entry.linkedPR})` : "";
    blocks.push(bulletItem(`🔄 ${entry.name}${prRef}`));
  }

  return blocks;
}

/** Create a Weekly Sync meeting note in Notion. */
export async function createWeeklySyncPage(
  github: GitHubMetrics,
  knowledge: KnowledgeMetrics,
  contextSync: ContextSyncMetrics,
  delta: WeeklyDelta | null
): Promise<string> {
  const notion = getNotionClient();
  const today = new Date();
  const title = `Weekly Sync - ${formatDateKST(today)}`;
  const dateStr = today.toISOString().split("T")[0];

  // Create the page
  const page = await notion.pages.create({
    parent: { database_id: CONTEXT_SYNC_DB },
    properties: {
      Title: {
        title: [{ text: { content: title } }],
      },
      "날짜": {
        date: { start: dateStr },
      },
    },
  });

  // Build content blocks
  const blocks: BlockObjectRequest[] = [];

  // 1. Company Status
  blocks.push(heading2("1. Company Status"));
  blocks.push(divider());
  blocks.push(bulletItem("Operation: [수동 입력]"));
  blocks.push(bulletItem("Business: [수동 입력]"));

  // 2. Objective
  blocks.push(heading2("2. Objective: zkVM supports(e2e)"));
  blocks.push(divider());
  blocks.push(
    heading3("1Q Objective: Poseidon/NTT/Sumcheck/MerkleTree 90% SOTA")
  );
  blocks.push(paragraph("[OKR 현황 자동 수집 예정]"));
  blocks.push(heading3("2Q Objective: E2E zkVMs"));
  blocks.push(paragraph("[현황 자동 수집 예정]"));

  // 3. Milestone sharing
  blocks.push(heading2("3. Milestone sharing"));
  blocks.push(divider());
  for (const member of TEAM) {
    blocks.push(...buildMemberMilestone(member.name, github));
  }

  // 4. Retro
  blocks.push(heading2("4. Retro."));
  blocks.push(divider());
  blocks.push(...buildRetroSection(github, knowledge, contextSync, delta));

  // Auto-generated sections
  blocks.push(divider());
  blocks.push(
    callout(
      `이번 주 Context Sync 요약 & Knowledge Graph 업데이트 (자동 생성)`,
      "📊"
    )
  );
  blocks.push(...buildContextSyncSection(contextSync));
  blocks.push(...buildKnowledgeSection(knowledge));

  // Dashboard link
  blocks.push(divider());
  blocks.push(heading3("📈 Weekly Metrics"));
  blocks.push(
    paragraph(`Full Dashboard: ${DASHBOARD_URL}/week/${github.weekId}`)
  );

  // Notion API limits appending to 100 blocks at a time
  const BATCH_SIZE = 100;
  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    await notion.blocks.children.append({
      block_id: page.id,
      children: blocks.slice(i, i + BATCH_SIZE),
    });
  }

  return page.id;
}
