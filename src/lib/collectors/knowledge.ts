// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Octokit } from "@octokit/rest";
import { ORG, KNOWLEDGE_REPO } from "../config";
import { getWeekRange } from "../week";
import type { KnowledgeMetrics, KnowledgePRSummary, KnowledgeEntry } from "../types";

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return new Octokit({ auth: token });
}

/** Parse the monthly PR summary file (_sources/prs/YYYY-MM.md). */
function parsePRSummaries(
  content: string,
  weekStart: Date,
  weekEnd: Date
): KnowledgePRSummary[] {
  const summaries: KnowledgePRSummary[] = [];
  // Split by PR header: ## repo#number - title
  const prBlocks = content.split(/^## /m).slice(1);

  for (const block of prBlocks) {
    const headerMatch = block.match(/^(.+?)#(\d+)\s*[-–]\s*(.+)/);
    if (!headerMatch) continue;

    const [, repo, numStr, title] = headerMatch;
    const number = parseInt(numStr, 10);

    // Extract merge date
    const dateMatch = block.match(/\*\*Merged\*\*:\s*(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;

    const mergedDate = new Date(dateMatch[1] + "T00:00:00Z");
    if (mergedDate < weekStart || mergedDate > weekEnd) continue;

    // Extract knowledge created
    const createdMatch = block.match(
      /\*\*Knowledge Created\*\*:\s*(.+?)(?:\n|$)/
    );
    const knowledgeCreated: string[] = [];
    if (createdMatch) {
      const links = createdMatch[1].match(/\[\[(.+?)\]\]/g);
      if (links) {
        for (const link of links) {
          knowledgeCreated.push(link.replace(/\[\[|\]\]/g, ""));
        }
      }
    }

    // Extract knowledge updated
    const updatedMatch = block.match(
      /\*\*Knowledge Updated\*\*:\s*(.+?)(?:\n|$)/
    );
    const knowledgeUpdated: string[] = [];
    if (updatedMatch) {
      const links = updatedMatch[1].match(/\[\[(.+?)\]\]/g);
      if (links) {
        for (const link of links) {
          knowledgeUpdated.push(link.replace(/\[\[|\]\]/g, ""));
        }
      }
    }

    // Check if skipped
    const knowledgeSkipped = /\*\*Knowledge Skipped\*\*:/.test(block);

    summaries.push({
      repo: repo.trim(),
      number,
      title: title.trim(),
      mergedDate: dateMatch[1],
      knowledgeCreated,
      knowledgeUpdated,
      knowledgeSkipped,
    });
  }

  return summaries;
}

/** Categorize a knowledge entry by its file path in the repo. */
function categorizeEntry(
  name: string,
  changedFiles: string[]
): KnowledgeEntry["category"] {
  for (const file of changedFiles) {
    if (file.includes(`concepts/${name}`)) return "concepts";
    if (file.includes(`conventions/${name}`)) return "conventions";
    if (file.includes(`decisions/${name}`)) return "decisions";
    if (file.includes(`pitfalls/${name}`)) return "pitfalls";
  }
  return "concepts"; // default
}

/** Collect knowledge graph metrics for a given week. */
export async function collectKnowledgeMetrics(
  weekId: string
): Promise<KnowledgeMetrics> {
  const octokit = getOctokit();
  const { start, end } = getWeekRange(weekId);

  // Determine which monthly files to fetch
  const months = new Set<string>();
  months.add(
    `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`
  );
  months.add(
    `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}`
  );

  let allSummaries: KnowledgePRSummary[] = [];

  for (const month of months) {
    try {
      const { data } = await octokit.repos.getContent({
        owner: ORG,
        repo: KNOWLEDGE_REPO,
        path: `_sources/prs/${month}.md`,
      });

      if ("content" in data) {
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        const summaries = parsePRSummaries(content, start, end);
        allSummaries = allSummaries.concat(summaries);
      }
    } catch (error) {
      // File may not exist for this month yet
      console.warn(`No PR summary file for ${month}:`, error);
    }
  }

  // Get changed files this week via commits
  let changedFiles: string[] = [];
  try {
    const { data: commits } = await octokit.repos.listCommits({
      owner: ORG,
      repo: KNOWLEDGE_REPO,
      since: start.toISOString(),
      until: end.toISOString(),
      per_page: 100,
    });

    for (const commit of commits) {
      const { data: detail } = await octokit.repos.getCommit({
        owner: ORG,
        repo: KNOWLEDGE_REPO,
        ref: commit.sha,
      });
      const files = detail.files?.map((f) => f.filename) ?? [];
      changedFiles = changedFiles.concat(files);
    }
  } catch (error) {
    console.warn("Failed to fetch knowledge-graph commits:", error);
  }

  // Aggregate
  const allCreated = allSummaries.flatMap((s) => s.knowledgeCreated);
  const allUpdated = allSummaries.flatMap((s) => s.knowledgeUpdated);
  const totalSkipped = allSummaries.filter((s) => s.knowledgeSkipped).length;

  const newEntries: KnowledgeEntry[] = [...new Set(allCreated)].map((name) => ({
    name,
    category: categorizeEntry(name, changedFiles),
    linkedPR: allSummaries.find((s) => s.knowledgeCreated.includes(name))
      ? `${allSummaries.find((s) => s.knowledgeCreated.includes(name))!.repo}#${allSummaries.find((s) => s.knowledgeCreated.includes(name))!.number}`
      : null,
  }));

  const updatedEntries: KnowledgeEntry[] = [...new Set(allUpdated)].map(
    (name) => ({
      name,
      category: categorizeEntry(name, changedFiles),
      linkedPR: allSummaries.find((s) => s.knowledgeUpdated.includes(name))
        ? `${allSummaries.find((s) => s.knowledgeUpdated.includes(name))!.repo}#${allSummaries.find((s) => s.knowledgeUpdated.includes(name))!.number}`
        : null,
    })
  );

  // Category counts from changed files
  const byCategory: Record<string, number> = {};
  for (const file of changedFiles) {
    for (const cat of ["concepts", "conventions", "decisions", "pitfalls"]) {
      if (file.startsWith(`${cat}/`)) {
        byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      }
    }
  }

  return {
    weekId,
    prSummaries: allSummaries,
    totalCreated: newEntries.length,
    totalUpdated: updatedEntries.length,
    totalSkipped,
    newEntries,
    updatedEntries,
    byCategory,
  };
}
