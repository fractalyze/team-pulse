// Copyright 2026 Fractalyze Inc. All rights reserved.

// --- Team & Config ---

export interface TeamMember {
  name: string;
  github: string;
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
  body: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  milestone: string | null;
  draft: boolean;
  readyForReviewAt: string | null;
}

export interface RepoPRSummary {
  repo: string;
  merged: PRInfo[];
  open: PRInfo[];
  totalMerged: number;
  totalOpen: number;
}

export interface ReviewInfo {
  prNumber: number;
  repo: string;
  reviewer: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
  submittedAt: string;
}

export interface MissedReviewEntry {
  prKey: string;
  missedReviewers: string[];
}

export interface ReviewHealthMetrics {
  totalReviews: number;
  totalApprovals: number;
  prsWithNoReview: number;
  unreviewedPRKeys: string[];
  avgReviewLatencyHours: number | null;
  avgLeadTimeHours: number | null;
  missedReviews: MissedReviewEntry[];
  byReviewer: Record<string, number>;
}

export interface GitHubMetrics {
  weekId: string;
  repos: RepoPRSummary[];
  totalMerged: number;
  totalOpen: number;
  byAuthor: Record<string, { merged: number; open: number }>;
  avgLeadTimeDays: number | null;
  totalCommits: number;
  commitsByAuthor: Record<string, number>;
  reviewHealth: ReviewHealthMetrics;
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

// --- Goal System (3-Tier) ---

export type GoalStatus = "not_started" | "in_progress" | "done" | "closed";
export type GoalSource = "manual" | "github";

export interface HalfYearObjective {
  id: string;
  period: string;
  title: string;
  description?: string;
  source?: GoalSource;
  githubUrl?: string;
  githubItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyGoal {
  id: string;
  month: string;
  title: string;
  status: GoalStatus;
  source?: GoalSource;
  githubUrl?: string;
  githubItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyTask {
  id: string;
  weekId: string;
  assignee: string;
  content: string;
  deadline: string;
  status: GoalStatus;
  startDate?: string; // "YYYY-MM-DD"
  goalId?: string; // MonthlyGoal.id reference
  source?: GoalSource;
  githubUrl?: string;
  githubItemId?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Roadmap Data ---

export interface RoadmapWeek {
  weekId: string;
  weekLabel: string; // "W10 · 3/2-3/8"
  tasks: WeeklyTask[];
  achievementRate: number; // 0-100
  blockingCount: number;
  isCurrent: boolean;
}

export interface RoadmapMonth {
  month: string;
  label: string; // "3월"
  goals: MonthlyGoal[];
  weeks: RoadmapWeek[];
  progressRate: number; // 0-100 (done goals / total goals)
  isAtRisk: boolean;
  isCurrent: boolean;
}

export interface RoadmapData {
  halfYear: HalfYearObjective | null;
  halfProgress: number; // 0-100
  months: RoadmapMonth[];
  currentWeekId: string;
}

// --- OKR Data ---

export interface OKRStatus {
  objective: string;
  quarter: string;
  keyResults: {
    name: string;
    status: "done" | "in_progress" | "not_started" | "at_risk";
    statusText: string;
  }[];
}

export interface WeeklyGoal {
  month: string;
  week: string;
  content: string;
  isHardDeadline: boolean;
}

export interface OKRMetrics {
  weekId: string;
  objectives: OKRStatus[];
  thisWeekGoal: WeeklyGoal | null;
  nextHardDeadline: WeeklyGoal | null;
}

// --- Propagation Tracking ---

export interface PropagationEntry {
  prNumber: number;
  repo: string;
  prTitle: string;
  author: string;
  knowledgeEntries: string[];
  contextSyncMentions: string[];
  propagationScore: 0 | 1 | 2 | 3;
}

// --- GitHub Projects Data ---

export interface ProjectItem {
  id: string;
  type: "ISSUE" | "PULL_REQUEST" | "DRAFT_ISSUE";
  title: string;
  url: string | null;
  repo: string | null;
  number: number | null;
  author: string | null;
  assignees: string[];
  sprint: string | null;
  monthlyGoal: string | null;
  weeklyGoal: string | null;
  status: string | null;
  level: string | null;
  merged: boolean;
  mergedAt: string | null;
}

export interface GoalProgressSummary {
  goalName: string;
  totalItems: number;
  mergedCount: number;
  inReviewCount: number;
  draftCount: number;
  closedCount: number;
  assignees: string[];
  progressPercent: number;
}

export interface ProjectMetrics {
  weekId: string;
  sprint: string;
  items: ProjectItem[];
  byGoal: Record<string, ProjectItem[]>;
  byWeeklyGoal: Record<string, ProjectItem[]>;
  byAssignee: Record<string, ProjectItem[]>;
  byStatus: Record<string, number>;
  goalProgress: GoalProgressSummary[];
}

// --- Weekly Snapshot (stored in KV) ---

export interface WeeklySnapshot {
  weekId: string;
  collectedAt: string;
  github: GitHubMetrics;
  knowledge?: KnowledgeMetrics;
  contextSync: ContextSyncMetrics;
  okr?: OKRMetrics;
  propagation?: PropagationEntry[];
  project?: ProjectMetrics;
}

// --- Delta (week-over-week comparison) ---

export interface WeeklyDelta {
  prsMergedDelta: number;
  prsOpenDelta: number;
  contextSyncSessionsDelta: number;
  commitsDelta: number;
  avgReviewLatencyDelta: number | null;
  unreviewedMergesDelta: number;
}

// --- Dashboard View Models ---

export interface DashboardSummary {
  current: WeeklySnapshot;
  delta: WeeklyDelta | null;
  previousWeekId: string | null;
  nextWeekId: string | null;
  allWeekIds: string[];
}
