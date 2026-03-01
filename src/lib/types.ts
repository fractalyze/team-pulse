// Copyright 2026 Fractalyze Inc. All rights reserved.

// --- Team & Config ---

export interface TeamMember {
  name: string;
  github: string;
  slack: string;
}

export interface RepoOKRMapping {
  [repo: string]: string;
}

// --- GitHub PR Data ---

export interface PRInfo {
  repo: string;
  number: number;
  title: string;
  author: string;
  url: string;
  state: "open" | "closed" | "merged";
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  reviewers: string[];
  leadTimeDays: number | null;
}

export interface RepoPRSummary {
  repo: string;
  merged: PRInfo[];
  open: PRInfo[];
  totalMerged: number;
  totalOpen: number;
}

export interface GitHubMetrics {
  weekId: string;
  repos: RepoPRSummary[];
  totalMerged: number;
  totalOpen: number;
  byAuthor: Record<string, { merged: number; open: number }>;
  byObjective: Record<string, number>;
  avgLeadTimeDays: number | null;
}

// --- Knowledge Graph Data ---

export interface KnowledgeEntry {
  name: string;
  category: "concepts" | "conventions" | "decisions" | "pitfalls";
  linkedPR: string | null;
}

export interface KnowledgePRSummary {
  repo: string;
  number: number;
  title: string;
  mergedDate: string;
  knowledgeCreated: string[];
  knowledgeUpdated: string[];
  knowledgeSkipped: boolean;
}

export interface KnowledgeMetrics {
  weekId: string;
  prSummaries: KnowledgePRSummary[];
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
  newEntries: KnowledgeEntry[];
  updatedEntries: KnowledgeEntry[];
  byCategory: Record<string, number>;
}

// --- Context Sync Data ---

export interface ContextSyncNote {
  id: string;
  title: string;
  date: string;
  topics: string[];
  keyInsights: string[];
  actionItems: { text: string; assignee: string; done: boolean }[];
}

export interface ContextSyncMetrics {
  weekId: string;
  notes: ContextSyncNote[];
  totalSessions: number;
  totalTopics: number;
  totalActionItems: number;
  pendingActionItems: number;
}

// --- Milestone Tracking ---

export interface MemberMilestone {
  name: string;
  achieved: string[];
  blockingPoints: string[];
  nextWeekGoals: string[];
}

// --- Weekly Snapshot (stored in KV) ---

export interface WeeklySnapshot {
  weekId: string;
  collectedAt: string;
  github: GitHubMetrics;
  knowledge: KnowledgeMetrics;
  contextSync: ContextSyncMetrics;
  milestones: MemberMilestone[];
}

// --- Delta (week-over-week comparison) ---

export interface WeeklyDelta {
  prsMergedDelta: number;
  prsOpenDelta: number;
  knowledgeCreatedDelta: number;
  knowledgeUpdatedDelta: number;
  contextSyncSessionsDelta: number;
}

// --- Dashboard View Models ---

export interface DashboardSummary {
  current: WeeklySnapshot;
  delta: WeeklyDelta | null;
  previousWeekId: string | null;
}
