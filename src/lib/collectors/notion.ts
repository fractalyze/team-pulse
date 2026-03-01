// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Client } from "@notionhq/client";
import { CONTEXT_SYNC_DB } from "../config";
import { getWeekRange } from "../week";
import type { ContextSyncNote, ContextSyncMetrics } from "../types";

function getNotionClient(): Client {
  const token = process.env.NOTION_API_KEY;
  if (!token) throw new Error("NOTION_API_KEY is not set");
  return new Client({ auth: token });
}

type BlockObject = Awaited<
  ReturnType<Client["blocks"]["children"]["list"]>
>["results"][number];

/** Extract text from a rich text array. */
function richTextToPlain(
  richText: Array<{ plain_text: string }>
): string {
  return richText.map((t) => t.plain_text).join("");
}

/** Extract topics (heading blocks) from page content. */
function extractTopics(blocks: BlockObject[]): string[] {
  const topics: string[] = [];
  for (const block of blocks) {
    if (!("type" in block)) continue;
    const b = block as Record<string, unknown>;
    if (
      b.type === "heading_2" &&
      b.heading_2 &&
      typeof b.heading_2 === "object"
    ) {
      const h2 = b.heading_2 as { rich_text: Array<{ plain_text: string }> };
      if (h2.rich_text) {
        const text = richTextToPlain(h2.rich_text);
        if (text) topics.push(text);
      }
    }
    if (
      b.type === "heading_3" &&
      b.heading_3 &&
      typeof b.heading_3 === "object"
    ) {
      const h3 = b.heading_3 as { rich_text: Array<{ plain_text: string }> };
      if (h3.rich_text) {
        const text = richTextToPlain(h3.rich_text);
        if (text) topics.push(text);
      }
    }
  }
  return topics;
}

/** Extract key insights from callout blocks. */
function extractInsights(blocks: BlockObject[]): string[] {
  const insights: string[] = [];
  for (const block of blocks) {
    if (!("type" in block)) continue;
    const b = block as Record<string, unknown>;
    if (b.type === "callout" && b.callout && typeof b.callout === "object") {
      const callout = b.callout as {
        rich_text: Array<{ plain_text: string }>;
      };
      if (callout.rich_text) {
        const text = richTextToPlain(callout.rich_text);
        if (text) insights.push(text);
      }
    }
  }
  return insights;
}

/** Extract action items from to_do blocks. */
function extractActionItems(
  blocks: BlockObject[]
): ContextSyncNote["actionItems"] {
  const items: ContextSyncNote["actionItems"] = [];
  for (const block of blocks) {
    if (!("type" in block)) continue;
    const b = block as Record<string, unknown>;
    if (b.type === "to_do" && b.to_do && typeof b.to_do === "object") {
      const todo = b.to_do as {
        rich_text: Array<{ plain_text: string }>;
        checked: boolean;
      };
      if (todo.rich_text) {
        const text = richTextToPlain(todo.rich_text);
        // Try to extract assignee from text (e.g., "@Ryan: do something")
        const assigneeMatch = text.match(/^@(\w+):\s*/);
        items.push({
          text: assigneeMatch ? text.replace(assigneeMatch[0], "") : text,
          assignee: assigneeMatch?.[1] ?? "",
          done: todo.checked,
        });
      }
    }
  }
  return items;
}

/** Collect Context Sync notes for a given week. */
export async function collectContextSyncMetrics(
  weekId: string
): Promise<ContextSyncMetrics> {
  const notion = getNotionClient();
  const { start, end } = getWeekRange(weekId);

  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  // Query Context Sync database for this week's entries
  const response = await notion.databases.query({
    database_id: CONTEXT_SYNC_DB,
    filter: {
      and: [
        {
          property: "날짜",
          date: { on_or_after: startStr },
        },
        {
          property: "날짜",
          date: { on_or_before: endStr },
        },
      ],
    },
    sorts: [{ property: "날짜", direction: "ascending" }],
  });

  const notes: ContextSyncNote[] = [];

  for (const page of response.results) {
    if (!("properties" in page)) continue;

    const props = page.properties as Record<string, unknown>;

    // Extract title
    let title = "";
    const titleProp = props["Title"] ?? props["Name"] ?? props["이름"];
    if (titleProp && typeof titleProp === "object") {
      const tp = titleProp as {
        title?: Array<{ plain_text: string }>;
      };
      if (tp.title) title = richTextToPlain(tp.title);
    }

    // Extract date
    let date = "";
    const dateProp = props["날짜"];
    if (dateProp && typeof dateProp === "object") {
      const dp = dateProp as { date?: { start?: string } };
      if (dp.date?.start) date = dp.date.start;
    }

    // Fetch page blocks for content extraction
    try {
      const blocks = await notion.blocks.children.list({
        block_id: page.id,
        page_size: 100,
      });

      const topics = extractTopics(blocks.results);
      const keyInsights = extractInsights(blocks.results);
      const actionItems = extractActionItems(blocks.results);

      notes.push({
        id: page.id,
        title,
        date,
        topics,
        keyInsights,
        actionItems,
      });
    } catch (error) {
      console.warn(`Failed to fetch blocks for page ${page.id}:`, error);
      notes.push({
        id: page.id,
        title,
        date,
        topics: [],
        keyInsights: [],
        actionItems: [],
      });
    }
  }

  const totalActionItems = notes.reduce(
    (sum, n) => sum + n.actionItems.length,
    0
  );
  const pendingActionItems = notes.reduce(
    (sum, n) => sum + n.actionItems.filter((a) => !a.done).length,
    0
  );

  return {
    weekId,
    notes,
    totalSessions: notes.length,
    totalTopics: notes.reduce((sum, n) => sum + n.topics.length, 0),
    totalActionItems,
    pendingActionItems,
  };
}
