// Copyright 2026 Fractalyze Inc. All rights reserved.

// --- Team & Config ---

export interface TeamMember {
  name: string;
  github: string;
  slack: string;
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

export type GoalStatus = "not_started" | "in_progress" | "done";

export interface HalfYearObjective {
  id: string;
  period: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyGoal {
  id: string;
  month: string;
  title: string;
  status: GoalStatus;
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

// --- Cross-Repo Milestones ---

export interface MilestoneMetadata {
  title: string;
  description: string;
  dueOn: string | null;
  repos: string[];
}

export interface MilestonePRRef {
  repo: string;
  number: number;
  title: string;
  author: string;
  url: string;
  state: "open" | "merged" | "closed";
}

export interface RepoMilestoneDetail {
  repo: string;
  prs: MilestonePRRef[];
}

export interface CrossRepoMilestone {
  title: string;
  description: string;
  dueOn: string | null;
  repos: RepoMilestoneDetail[];
  mergedCount: number;
  openCount: number;
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
  crossRepoMilestones?: CrossRepoMilestone[];
}

// --- Claude Code Usage ---

export interface ClaudeCodeTokens {
  input: number;
  output: number;
  cache_creation: number;
  cache_read: number;
}

export interface ClaudeCodeModelUsage {
  model: string;
  tokens: ClaudeCodeTokens;
  estimated_cost: { amount: number; currency: string };
}

export interface ClaudeCodeToolAction {
  accepted: number;
  rejected: number;
}

export interface ClaudeCodeUserRecord {
  actor: { type: string; email_address?: string; api_key_name?: string };
  date: string;
  terminal_type: string;
  customer_type: string;
  organization_id: string;
  core_metrics: {
    num_sessions: number;
    lines_of_code: { added: number; removed: number };
    commits_by_claude_code: number;
    pull_requests_by_claude_code: number;
  };
  tool_actions: Record<string, ClaudeCodeToolAction>;
  model_breakdown: ClaudeCodeModelUsage[];
}

export interface ClaudeCodeDailySnapshot {
  date: string;
  collectedAt: string;
  records: ClaudeCodeUserRecord[];
  totals: {
    costCents: number;
    sessions: number;
    locAdded: number;
    locRemoved: number;
    commits: number;
    pullRequests: number;
  };
}

export interface ClaudeCodeUserAggregation {
  email: string;
  costCents: number;
  sessions: number;
  locAdded: number;
  locRemoved: number;
  commits: number;
  pullRequests: number;
  acceptanceRate: number;
  cacheReadRatio: number;
  modelBreakdown: { model: string; costCents: number }[];
}

export interface ClaudeCodeModelAggregation {
  model: string;
  costCents: number;
  tokens: ClaudeCodeTokens;
}

export interface ClaudeCodeUsageSummary {
  days: ClaudeCodeDailySnapshot[];
  periodDays: number;
  totals: {
    costCents: number;
    sessions: number;
    locAdded: number;
    locRemoved: number;
    commits: number;
    pullRequests: number;
  };
  costDeltaCents: number | null;
  byUser: ClaudeCodeUserAggregation[];
  byModel: ClaudeCodeModelAggregation[];
  dailyCosts: { date: string; costCents: number }[];
  tokenBreakdown: {
    input: number;
    output: number;
    cacheCreation: number;
    cacheRead: number;
  };
  perUserDaily: {
    email: string;
    dailyCosts: { date: string; costCents: number }[];
  }[];
}

// --- OTel Ingestion Types ---

/** OTel 메트릭 파서가 반환하는 단일 데이터 포인트. */
export interface ParsedOtelEntry {
  email: string;
  date: string; // YYYY-MM-DD (timeUnixNano에서 변환)
  metric: string; // e.g. "claude_code.token.usage"
  value: number;
  attributes: Record<string, string>; // e.g. { type: "input", model: "..." }
}

/** 단일 사용자의 하루치 누적 OTel 메트릭. KV 저장 단위. */
export interface OtelUserDayMetrics {
  email: string;
  date: string;
  lastUpdated: string;
  costCents: number;
  tokens: ClaudeCodeTokens; // 기존 타입 재사용
  sessions: number;
  locAdded: number;
  locRemoved: number;
  commits: number;
  pullRequests: number;
  toolAccepted: number;
  toolRejected: number;
  modelCosts: Record<string, number>;
  modelTokens: Record<string, ClaudeCodeTokens>;
}

/** Admin 패널용 OTel 연결 상태. */
export interface OtelConnectionStatus {
  email: string;
  lastSeen: string;
  totalDataPoints: number;
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
