// Copyright 2026 Fractalyze Inc. All rights reserved.

import type { ClaudeCodeUsageSummary } from "@/lib/types";
import { getClaudeCodeSummary } from "@/lib/store/claude-code";
import { getDashboardSummary } from "@/lib/store/kv";
import { getTeam } from "@/lib/team";
import { UsageContent } from "./usage-content";

export const dynamic = "force-dynamic";

interface UsagePageProps {
  searchParams: Promise<{ days?: string }>;
}

export default async function UsagePage({ searchParams }: UsagePageProps) {
  const { days: daysParam } = await searchParams;
  const days = [7, 14, 30].includes(Number(daysParam))
    ? Number(daysParam)
    : 30;

  let summary: ClaudeCodeUsageSummary | null = null;
  try {
    summary = await getClaudeCodeSummary(days);
  } catch {
    // KV not configured yet
  }

  // Build email → name mapping from team
  const teamMap: Record<string, string> = {};
  try {
    const team = await getTeam();
    for (const m of team) {
      // Team members are matched by GitHub username; emails from Claude Code may
      // include their GitHub-associated email. Store name keyed by lowercase name
      // for fuzzy matching in the client.
      teamMap[m.github.toLowerCase()] = m.name;
      teamMap[m.name.toLowerCase()] = m.name;
    }
  } catch {
    // team discovery may fail if GITHUB_TOKEN not set
  }

  // Fetch review latency from GitHub dashboard
  let avgReviewLatencyHours: number | null = null;
  try {
    const dashboard = await getDashboardSummary();
    avgReviewLatencyHours =
      dashboard?.current.github.reviewHealth.avgReviewLatencyHours ?? null;
  } catch {
    // dashboard data may not be available
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Claude Code Usage
        </h1>
        <p className="text-gray-500">
          No usage data yet. Configure Claude Code OTel to start collecting
          individual usage data. See Admin page for setup instructions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Claude Code Usage
      </h1>
      <UsageContent
        summary={summary}
        currentDays={days}
        teamMap={teamMap}
        avgReviewLatencyHours={avgReviewLatencyHours}
      />
    </div>
  );
}
