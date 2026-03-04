// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Client } from "@notionhq/client";
import { CONTEXT_SYNC_DB, DASHBOARD_URL } from "../config";
import type { TeamMember } from "../types";
import { formatDateKST, getWeekId } from "../week";
import type {
  GitHubMetrics,
  ContextSyncMetrics,
  OKRMetrics,
  WeeklyDelta,
  ReviewHealthMetrics,
} from "../types";

type BlockObjectRequest = Parameters<
  Client["blocks"]["children"]["append"]
>[0]["children"][number];

function getNotionClient(): Client {
  const token = process.env.NOTION_API_KEY;
  if (!token) throw new Error("NOTION_API_KEY is not set");
  return new Client({ auth: token });
}

// --- Block helpers ---

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

function quote(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "quote",
    quote: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

function toggle(text: string): BlockObjectRequest {
  return {
    object: "block",
    type: "toggle",
    toggle: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

// --- Section builders ---

/** Build OKR section (Section 2). */
function buildOKRSection(
  okr: OKRMetrics,
  github: GitHubMetrics
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  // Weekly Goal schedule
  blocks.push(heading3("이번 주 목표 (Weekly Goal Schedule)"));
  if (okr.thisWeekGoal) {
    blocks.push(
      quote(
        `${okr.thisWeekGoal.month} ${okr.thisWeekGoal.week} week: ${okr.thisWeekGoal.content}`
      )
    );
  } else {
    blocks.push(paragraph("이번 주 목표: [데이터 없음]"));
  }

  if (okr.nextHardDeadline) {
    blocks.push(
      callout(
        `Next HARD deadline: ${okr.nextHardDeadline.month} ${okr.nextHardDeadline.week} week - ${okr.nextHardDeadline.content}`,
        "⚠️"
      )
    );
  }

  // OKR objectives with KR tables
  for (const obj of okr.objectives) {
    blocks.push(heading3(`${obj.quarter} Objective: ${obj.objective}`));

    for (const kr of obj.keyResults) {
      const statusIcon =
        kr.status === "done"
          ? "✅"
          : kr.status === "at_risk"
            ? "🔴"
            : kr.status === "in_progress"
              ? "🔄"
              : "⬜";
      blocks.push(
        bulletItem(`${statusIcon} ${kr.name} — ${kr.statusText}`)
      );
    }

    // Find PRs that contribute to this objective's repos
    const objRepos = github.repos.filter((r) => r.totalMerged > 0);
    const contributingPRs = objRepos.flatMap((r) =>
      r.merged.slice(0, 3).map((pr) => `${pr.repo}#${pr.number}: ${pr.title}`)
    );

    if (contributingPRs.length > 0) {
      blocks.push(paragraph("이번 주 KR 기여 PR:"));
      for (const prRef of contributingPRs.slice(0, 5)) {
        blocks.push(bulletItem(prRef));
      }
    }
  }

  return blocks;
}

/** Build milestone section (Section 3). */
function buildMilestoneSection(
  github: GitHubMetrics,
  reviewHealth: ReviewHealthMetrics,
  team: TeamMember[]
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  for (const member of team) {
    blocks.push(heading3(member.name));
    blocks.push(bulletItem("next week → [수동 입력]"));

    // Achieve: merged PRs
    const memberPRs = github.repos.flatMap((r) =>
      r.merged.filter(
        (pr) => member.github !== "TBD" && pr.author === member.github
      )
    );

    if (memberPRs.length > 0) {
      blocks.push(paragraph("achieve (자동)"));
      for (const pr of memberPRs) {
        blocks.push(
          bulletItem(
            `${pr.repo}#${pr.number}: ${pr.title} (merged ${formatDateKST(pr.mergedAt!)})`
          )
        );
      }
    } else {
      blocks.push(bulletItem("achieve: [이번 주 머지된 PR 없음]"));
    }

    // Review contributions
    const reviewCount = member.github !== "TBD"
      ? (reviewHealth.byReviewer[member.github] ?? 0)
      : 0;
    if (reviewCount > 0) {
      blocks.push(bulletItem(`타인 PR ${reviewCount}건 리뷰`));
    }

    // Blocking point: open PRs with long review wait
    const openPRs = github.repos.flatMap((r) =>
      r.open.filter(
        (pr) => member.github !== "TBD" && pr.author === member.github
      )
    );
    const blockedPRs = openPRs.filter((pr) => {
      const daysOpen = Math.floor(
        (Date.now() - new Date(pr.createdAt).getTime()) / 86400000
      );
      return daysOpen >= 2;
    });

    if (blockedPRs.length > 0) {
      blocks.push(paragraph("blocking point"));
      for (const pr of blockedPRs) {
        const daysOpen = Math.floor(
          (Date.now() - new Date(pr.createdAt).getTime()) / 86400000
        );
        blocks.push(
          bulletItem(`${pr.repo}#${pr.number}: ${daysOpen}일간 리뷰 대기 중`)
        );
      }
    }

    blocks.push(bulletItem("achievable? → [수동 입력]"));
  }

  return blocks;
}

/** Build retro section with auto-generated signals (Section 4). */
function buildRetroSection(
  github: GitHubMetrics,
  contextSync: ContextSyncMetrics,
  okr: OKRMetrics,
  delta: WeeklyDelta | null
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  // 1) Last week check (auto)
  blocks.push(heading3("1) Last week check (자동)"));

  const mergedDelta = delta
    ? ` (${delta.prsMergedDelta >= 0 ? "+" : ""}${delta.prsMergedDelta} vs last week)`
    : "";
  const repoCount = github.repos.filter((r) => r.totalMerged > 0).length;
  blocks.push(
    bulletItem(
      `PRs: ${github.totalMerged} merged${mergedDelta} across ${repoCount} repos, ${github.totalCommits} commits`
    )
  );

  const avgLatency = github.reviewHealth.avgReviewLatencyHours;
  const latencyText = avgLatency !== null ? `${avgLatency}h` : "N/A";
  blocks.push(
    bulletItem(
      `Reviews: 평균 ${latencyText} 대기, 리뷰 없이 머지 ${github.reviewHealth.prsWithNoReview}건`
    )
  );

  const pendingActions = contextSync.notes.reduce(
    (sum, n) => sum + n.actionItems.filter((a) => !a.done).length,
    0
  );
  const totalActions = contextSync.notes.reduce(
    (sum, n) => sum + n.actionItems.length,
    0
  );
  const doneActions = totalActions - pendingActions;
  blocks.push(
    bulletItem(
      `Context Sync: ${contextSync.totalSessions} sessions, ${contextSync.totalTopics} topics, ${totalActions} action items (${doneActions} 완료)`
    )
  );

  // 2) Signals (auto)
  blocks.push(heading3("2) Signals (자동 - 주의 필요 사항)"));

  // PRs with long review wait
  const longWaitPRs = github.repos
    .flatMap((r) => r.open)
    .filter((pr) => {
      const daysOpen = Math.floor(
        (Date.now() - new Date(pr.createdAt).getTime()) / 86400000
      );
      return daysOpen >= 5;
    });
  if (longWaitPRs.length > 0) {
    const prList = longWaitPRs
      .map((pr) => `${pr.repo}#${pr.number}`)
      .join(", ");
    blocks.push(
      callout(
        `PR ${longWaitPRs.length}건 > 5일 리뷰 없음: ${prList}`,
        "⚠️"
      )
    );
  }

  // Pending action items
  if (pendingActions > 0) {
    blocks.push(
      callout(
        `Action items ${totalActions}건 중 ${doneActions}건 완료`,
        "⚠️"
      )
    );
  }

  // Hard deadline warning
  if (okr.nextHardDeadline) {
    blocks.push(
      callout(
        `HARD deadline: ${okr.nextHardDeadline.month} ${okr.nextHardDeadline.week} week - ${okr.nextHardDeadline.content}`,
        "⚠️"
      )
    );
  }

  // 3-5) Manual sections
  blocks.push(heading3("3) What happened/Topic raised"));
  blocks.push(paragraph("[수동 입력]"));
  blocks.push(heading3("4) ONE focus"));
  blocks.push(paragraph("[수동 입력]"));
  blocks.push(heading3("5) Next week change"));
  blocks.push(paragraph("[수동 입력]"));

  return blocks;
}

/** Build appendix with toggle blocks. */
function buildAppendix(
  contextSync: ContextSyncMetrics,
  github: GitHubMetrics
): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  // Context Sync summary toggle
  if (contextSync.notes.length > 0) {
    blocks.push(toggle("Context Sync 이번 주 요약"));
    for (const note of contextSync.notes) {
      const topics = note.topics.slice(0, 3).join(", ") || "N/A";
      const insight = note.keyInsights[0] || "";
      blocks.push(
        bulletItem(
          `${formatDateKST(note.date)}: ${topics}${insight ? ` — ${insight}` : ""}`
        )
      );
    }
  }

  // Full PR list by repo toggle
  blocks.push(toggle("전체 PR 목록 (레포별)"));
  for (const repo of github.repos.filter((r) => r.totalMerged > 0)) {
    const prList = repo.merged
      .map((pr) => `#${pr.number} ${pr.title}`)
      .join(", ");
    blocks.push(
      bulletItem(`${repo.repo} (${repo.totalMerged} merged): ${prList}`)
    );
  }

  return blocks;
}

/** Create a Weekly Sync meeting note in Notion. */
export async function createWeeklySyncPage(
  github: GitHubMetrics,
  contextSync: ContextSyncMetrics,
  okr: OKRMetrics,
  delta: WeeklyDelta | null,
  team: TeamMember[] = []
): Promise<string> {
  const notion = getNotionClient();
  const today = new Date();
  const weekNum = getWeekId().replace(/^\d{4}-W/, "W");
  const title = `Weekly Sync - ${weekNum} ${formatDateKST(today)}`;
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

  // 2. Objective (OKR-centric)
  blocks.push(heading2("2. Objective: zkVM supports(e2e)"));
  blocks.push(divider());
  blocks.push(...buildOKRSection(okr, github));

  // 3. Milestone sharing (per-member)
  blocks.push(heading2("3. Milestone sharing"));
  blocks.push(divider());
  blocks.push(...buildMilestoneSection(github, github.reviewHealth, team));

  // 4. Retro
  blocks.push(heading2("4. Retro."));
  blocks.push(divider());
  blocks.push(
    ...buildRetroSection(github, contextSync, okr, delta)
  );

  // Appendix
  blocks.push(divider());
  blocks.push(heading2("Appendix (자동)"));
  blocks.push(
    ...buildAppendix(contextSync, github)
  );

  // Dashboard link
  blocks.push(divider());
  blocks.push(
    paragraph(`📈 Full Dashboard: ${DASHBOARD_URL}/week/${github.weekId}`)
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
