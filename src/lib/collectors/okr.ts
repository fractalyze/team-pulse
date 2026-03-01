// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Client } from "@notionhq/client";
import { OKR_PAGE_ID, WEEKLY_GOAL_PAGE } from "../config";
import { getWeekId } from "../week";
import type { OKRStatus, WeeklyGoal, OKRMetrics } from "../types";

function getNotionClient(): Client {
  const token = process.env.NOTION_API_KEY;
  if (!token) throw new Error("NOTION_API_KEY is not set");
  return new Client({ auth: token });
}

type RichText = { plain_text: string; annotations?: { strikethrough?: boolean } };
type BlockResponse = {
  type: string;
  heading_2?: { rich_text: RichText[] };
  heading_3?: { rich_text: RichText[] };
  bulleted_list_item?: { rich_text: RichText[] };
  paragraph?: { rich_text: RichText[] };
  has_children?: boolean;
  id: string;
};

/** Extract plain text from rich text array. */
function plainText(richText: RichText[]): string {
  return richText.map((t) => t.plain_text).join("");
}

/** Check if all segments are strikethrough. */
function isStrikethrough(richText: RichText[]): boolean {
  return (
    richText.length > 0 &&
    richText.every((t) => t.annotations?.strikethrough === true)
  );
}

/** Determine KR status from rich text annotations and content. */
function determineKRStatus(
  richText: RichText[]
): "done" | "in_progress" | "not_started" | "at_risk" {
  if (isStrikethrough(richText)) return "done";
  const text = plainText(richText).toLowerCase();
  if (text.includes("at risk") || text.includes("blocked")) return "at_risk";
  if (text.includes("not started") || text.includes("tbd")) return "not_started";
  return "in_progress";
}

/** Parse OKR page blocks into OKRStatus objects. */
function parseOKRBlocks(blocks: BlockResponse[]): OKRStatus[] {
  const objectives: OKRStatus[] = [];
  let current: OKRStatus | null = null;

  for (const block of blocks) {
    if (block.type === "heading_2" && block.heading_2) {
      const text = plainText(block.heading_2.rich_text);
      // Detect quarter from heading (e.g., "1Q Objective: ...")
      const quarterMatch = text.match(/^(\d)Q\s+Objective:\s*(.+)/i);
      if (quarterMatch) {
        if (current) objectives.push(current);
        current = {
          quarter: `${quarterMatch[1]}Q`,
          objective: quarterMatch[2].trim(),
          keyResults: [],
        };
      }
    } else if (block.type === "heading_3" && block.heading_3 && current) {
      // Heading 3 can also be a KR group header; skip it
    } else if (
      block.type === "bulleted_list_item" &&
      block.bulleted_list_item &&
      current
    ) {
      const richText = block.bulleted_list_item.rich_text;
      const text = plainText(richText);
      if (!text.trim()) continue;

      // Parse "KR1: description" or just bullet text as KR
      const krMatch = text.match(/^KR\d+:\s*(.+)/i);
      const name = krMatch ? krMatch[1].trim() : text.trim();
      const status = determineKRStatus(richText);

      current.keyResults.push({
        name,
        status,
        statusText: text.trim(),
      });
    }
  }

  if (current) objectives.push(current);
  return objectives;
}

/** Get current week identifier as "Nth" format (1st, 2nd, 3rd, 4th, 5th). */
function getCurrentWeekOfMonth(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const dayOfMonth = kst.getUTCDate();
  const weekNum = Math.ceil(dayOfMonth / 7);
  const suffixes: Record<number, string> = {
    1: "1st",
    2: "2nd",
    3: "3rd",
    4: "4th",
    5: "5th",
  };
  return suffixes[weekNum] ?? `${weekNum}th`;
}

/** Get current month abbreviation. */
function getCurrentMonth(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return months[kst.getUTCMonth()];
}

/** Parse Weekly Goal table page. */
async function parseWeeklyGoals(
  notion: Client
): Promise<WeeklyGoal[]> {
  const goals: WeeklyGoal[] = [];

  // Fetch all blocks from the Weekly Goal page
  let cursor: string | undefined;
  const allBlocks: BlockResponse[] = [];

  do {
    const response = await notion.blocks.children.list({
      block_id: WEEKLY_GOAL_PAGE,
      start_cursor: cursor,
      page_size: 100,
    });
    allBlocks.push(...(response.results as BlockResponse[]));
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  // Find the table block and parse its rows
  for (const block of allBlocks) {
    if (block.type === "table" && block.has_children) {
      const tableRows = await notion.blocks.children.list({
        block_id: block.id,
        page_size: 100,
      });

      let isFirstRow = true;
      for (const row of tableRows.results as Array<{
        type: string;
        table_row?: { cells: RichText[][] };
      }>) {
        if (row.type !== "table_row" || !row.table_row) continue;
        if (isFirstRow) {
          isFirstRow = false;
          continue; // Skip header row
        }

        const cells = row.table_row.cells;
        if (cells.length < 3) continue;

        const month = plainText(cells[0]).trim();
        const week = plainText(cells[1]).trim();
        const content = plainText(cells[2]).trim();

        if (!month && !week && !content) continue;

        goals.push({
          month,
          week,
          content,
          isHardDeadline:
            content.toLowerCase().includes("hard deadline") ||
            content.toLowerCase().includes("hard"),
        });
      }
      break; // Only parse the first table
    }

    // Also handle bulleted list items that may represent the table content
    if (
      block.type === "bulleted_list_item" &&
      block.bulleted_list_item
    ) {
      const text = plainText(block.bulleted_list_item.rich_text);
      // Try to parse "Mar | 1st | content" format
      const match = text.match(
        /^(\w+)\s*\|\s*(\w+)\s*\|\s*(.+)/
      );
      if (match) {
        goals.push({
          month: match[1],
          week: match[2],
          content: match[3].trim(),
          isHardDeadline:
            match[3].toLowerCase().includes("hard deadline") ||
            match[3].toLowerCase().includes("hard"),
        });
      }
    }
  }

  return goals;
}

/** Find the goal matching the current week. */
function findThisWeekGoal(
  goals: WeeklyGoal[],
  date: Date
): WeeklyGoal | null {
  const currentMonth = getCurrentMonth(date);
  const currentWeek = getCurrentWeekOfMonth(date);

  return (
    goals.find(
      (g) =>
        g.month.toLowerCase() === currentMonth.toLowerCase() &&
        g.week.toLowerCase() === currentWeek.toLowerCase()
    ) ?? null
  );
}

/** Find the next upcoming hard deadline. */
function findNextHardDeadline(
  goals: WeeklyGoal[],
  date: Date
): WeeklyGoal | null {
  const currentMonth = getCurrentMonth(date);
  const currentWeek = getCurrentWeekOfMonth(date);
  let foundCurrent = false;

  for (const goal of goals) {
    if (
      goal.month.toLowerCase() === currentMonth.toLowerCase() &&
      goal.week.toLowerCase() === currentWeek.toLowerCase()
    ) {
      foundCurrent = true;
      if (goal.isHardDeadline) return goal;
      continue;
    }
    if (foundCurrent && goal.isHardDeadline) {
      return goal;
    }
  }

  // If we haven't found current yet, search from start for any hard deadline
  return goals.find((g) => g.isHardDeadline) ?? null;
}

/** Collect OKR metrics from Notion pages. */
export async function collectOKRMetrics(
  weekId?: string
): Promise<OKRMetrics> {
  const notion = getNotionClient();
  const now = new Date();

  // Fetch OKR page blocks
  let cursor: string | undefined;
  const okrBlocks: BlockResponse[] = [];

  do {
    const response = await notion.blocks.children.list({
      block_id: OKR_PAGE_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    okrBlocks.push(...(response.results as BlockResponse[]));
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  const objectives = parseOKRBlocks(okrBlocks);

  // Fetch Weekly Goal table
  let goals: WeeklyGoal[] = [];
  try {
    goals = await parseWeeklyGoals(notion);
  } catch (error) {
    console.warn("Failed to parse weekly goals:", error);
  }

  const thisWeekGoal = findThisWeekGoal(goals, now);
  const nextHardDeadline = findNextHardDeadline(goals, now);

  return {
    weekId: weekId ?? getWeekId(),
    objectives,
    thisWeekGoal,
    nextHardDeadline,
  };
}
