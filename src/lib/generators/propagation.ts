// Copyright 2026 Fractalyze Inc. All rights reserved.

import type {
  GitHubMetrics,
  KnowledgeMetrics,
  ContextSyncMetrics,
  PropagationEntry,
} from "../types";

/**
 * Compute propagation score for each merged PR.
 *
 * Score 0: PR merged but no knowledge entry and no Context Sync mention (Gap)
 * Score 1: Knowledge entry exists for this PR
 * Score 2: PR mentioned in Context Sync discussion
 * Score 3: Both knowledge and Context Sync coverage (fully propagated)
 */
export function computePropagation(
  github: GitHubMetrics,
  knowledge: KnowledgeMetrics,
  contextSync: ContextSyncMetrics
): PropagationEntry[] {
  const entries: PropagationEntry[] = [];

  // Build a set of PR references from knowledge entries
  const knowledgeByPR = new Map<string, string[]>();
  for (const summary of knowledge.prSummaries) {
    const key = `${summary.repo}#${summary.number}`;
    const entries = [
      ...summary.knowledgeCreated,
      ...summary.knowledgeUpdated,
    ];
    if (entries.length > 0) {
      knowledgeByPR.set(key, entries);
    }
  }

  // Build a map of PR mentions in Context Sync notes
  const contextSyncMentions = new Map<string, string[]>();
  for (const note of contextSync.notes) {
    const allText = [
      note.title,
      ...note.topics,
      ...note.keyInsights,
      ...note.actionItems.map((a) => a.text),
    ].join(" ");

    // Look for repo#number patterns
    const prRefs = allText.matchAll(/(\w[\w-]*)#(\d+)/g);
    for (const match of prRefs) {
      const key = `${match[1]}#${match[2]}`;
      const existing = contextSyncMentions.get(key) ?? [];
      existing.push(note.title || note.date);
      contextSyncMentions.set(key, existing);
    }
  }

  // Score each merged PR
  const allMergedPRs = github.repos.flatMap((r) => r.merged);

  for (const pr of allMergedPRs) {
    const key = `${pr.repo}#${pr.number}`;
    const kEntries = knowledgeByPR.get(key) ?? [];
    const csMentions = contextSyncMentions.get(key) ?? [];

    const hasKnowledge = kEntries.length > 0;
    const hasContextSync = csMentions.length > 0;

    let score: 0 | 1 | 2 | 3;
    if (hasKnowledge && hasContextSync) score = 3;
    else if (hasContextSync) score = 2;
    else if (hasKnowledge) score = 1;
    else score = 0;

    entries.push({
      prNumber: pr.number,
      repo: pr.repo,
      prTitle: pr.title,
      author: pr.author,
      knowledgeEntries: kEntries,
      contextSyncMentions: csMentions,
      propagationScore: score,
    });
  }

  return entries;
}
