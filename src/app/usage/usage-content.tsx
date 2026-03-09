// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { MetricCard } from "@/components/charts/metric-card";
import { CostTrendChart } from "@/components/charts/usage-cost-trend";
import { ModelBreakdownChart } from "@/components/charts/usage-model-breakdown";
import { TokenBreakdownChart } from "@/components/charts/usage-token-breakdown";
import { EfficiencyChart } from "@/components/charts/usage-efficiency";
import type {
  ClaudeCodeUsageSummary,
  ClaudeCodeUserAggregation,
} from "@/lib/types";

interface UsageContentProps {
  summary: ClaudeCodeUsageSummary;
  currentDays: number;
  teamMap?: Record<string, string>;
  avgReviewLatencyHours?: number | null;
}

type SortKey = "cost" | "sessions" | "costPerSession" | "acceptance" | "cache";

function resolveUserName(
  email: string,
  teamMap?: Record<string, string>
): string {
  if (!teamMap) return email;
  // Try direct email match
  if (teamMap[email]) return teamMap[email];
  // Try lowercase email
  if (teamMap[email.toLowerCase()]) return teamMap[email.toLowerCase()];
  // Try extracting username part of email
  const username = email.split("@")[0];
  if (teamMap[username.toLowerCase()]) return teamMap[username.toLowerCase()];
  return email;
}

export function UsageContent({
  summary,
  currentDays,
  teamMap,
  avgReviewLatencyHours,
}: UsageContentProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const periods = [7, 14, 30] as const;

  const handlePeriodChange = (days: number) => {
    router.push(`/usage?days=${days}`);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortedUsers = useMemo(() => {
    const users = [...summary.byUser];
    const dir = sortAsc ? 1 : -1;
    users.sort((a, b) => {
      switch (sortKey) {
        case "cost":
          return (a.costCents - b.costCents) * dir;
        case "sessions":
          return (a.sessions - b.sessions) * dir;
        case "costPerSession": {
          const aCps = a.sessions > 0 ? a.costCents / a.sessions : 0;
          const bCps = b.sessions > 0 ? b.costCents / b.sessions : 0;
          return (aCps - bCps) * dir;
        }
        case "acceptance":
          return (a.acceptanceRate - b.acceptanceRate) * dir;
        case "cache":
          return (a.cacheReadRatio - b.cacheReadRatio) * dir;
        default:
          return 0;
      }
    });
    return users;
  }, [summary.byUser, sortKey, sortAsc]);

  // Compute derived metrics
  const costPerSession =
    summary.totals.sessions > 0
      ? summary.totals.costCents / summary.totals.sessions
      : 0;

  const totalInputTokens =
    summary.tokenBreakdown.input +
    summary.tokenBreakdown.cacheCreation +
    summary.tokenBreakdown.cacheRead;
  const avgCacheHitRatio =
    totalInputTokens > 0
      ? summary.tokenBreakdown.cacheRead / totalInputTokens
      : 0;

  // Efficiency insights
  const insights = useMemo(() => {
    const msgs: { type: "warning" | "info" | "success"; text: string }[] = [];

    if (avgCacheHitRatio < 0.3) {
      msgs.push({
        type: "warning",
        text: "캐시 활용률이 낮습니다. 세션 간격을 줄이면 context 캐시를 재활용하여 비용을 절감할 수 있습니다.",
      });
    } else if (avgCacheHitRatio > 0.5) {
      msgs.push({
        type: "success",
        text: `캐시 활용률이 ${formatPct(avgCacheHitRatio)}로 양호합니다.`,
      });
    }

    // Opus cost ratio
    const opusModels = summary.byModel.filter((m) =>
      m.model.includes("opus")
    );
    const opusCost = opusModels.reduce((s, m) => s + m.costCents, 0);
    const opusRatio =
      summary.totals.costCents > 0
        ? opusCost / summary.totals.costCents
        : 0;
    if (opusRatio > 0.7) {
      msgs.push({
        type: "warning",
        text: `Opus 사용이 전체 비용의 ${formatPct(opusRatio)}입니다. 단순 작업에 Sonnet/Haiku 활용을 고려하세요.`,
      });
    }

    // Average acceptance rate
    const avgAcceptance =
      summary.byUser.length > 0
        ? summary.byUser.reduce((s, u) => s + u.acceptanceRate, 0) /
          summary.byUser.length
        : 0;
    if (avgAcceptance < 0.6) {
      msgs.push({
        type: "warning",
        text: "Tool 수락률이 낮습니다. 프롬프트를 더 구체적으로 작성하면 불필요한 토큰 소비를 줄일 수 있습니다.",
      });
    }

    // Cost per session
    const cps = costPerSession / 100;
    if (cps > 5) {
      msgs.push({
        type: "warning",
        text: "세션당 비용이 높습니다. 작업을 작은 단위로 분리하면 캐시 효율이 향상됩니다.",
      });
    }

    return msgs;
  }, [
    summary,
    avgCacheHitRatio,
    costPerSession,
  ]);

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " \u25B2" : " \u25BC";
  };

  // Find per-user daily data
  const getUserDailyCosts = (email: string) =>
    summary.perUserDaily.find((u) => u.email === email)?.dailyCosts ?? [];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {periods.map((d) => (
          <button
            key={d}
            onClick={() => handlePeriodChange(d)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentDays === d
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Summary Cards — 6 cards in 2 rows */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard
          title="Total Cost"
          value={formatCost(summary.totals.costCents)}
          delta={
            summary.costDeltaCents !== null
              ? Math.round(summary.costDeltaCents) / 100
              : null
          }
          subtitle={`${summary.days.length} days collected`}
          color="purple"
        />
        <MetricCard
          title="Sessions"
          value={formatNum(summary.totals.sessions)}
          subtitle={`${summary.byUser.length} users`}
          color="blue"
        />
        <MetricCard
          title="Cost / Session"
          value={formatCost(costPerSession)}
          subtitle="Lower is more efficient"
          color={costPerSession / 100 > 5 ? "red" : "green"}
        />
        <MetricCard
          title="Avg Cache Hit"
          value={formatPct(avgCacheHitRatio)}
          subtitle="cache_read / (input + cache_write + cache_read)"
          color={avgCacheHitRatio > 0.5 ? "green" : avgCacheHitRatio > 0.3 ? "yellow" : "red"}
        />
        <MetricCard
          title="Lines of Code"
          value={`+${formatNum(summary.totals.locAdded)}`}
          subtitle={`-${formatNum(summary.totals.locRemoved)}`}
          color="green"
        />
        <MetricCard
          title="Commits + PRs"
          value={`${formatNum(summary.totals.commits)}`}
          subtitle={`${summary.totals.pullRequests} PRs`}
          color="yellow"
        />
      </div>

      {/* Token Breakdown */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Token Breakdown
        </h2>
        <TokenBreakdownChart tokenBreakdown={summary.tokenBreakdown} />
      </div>

      {/* Efficiency Insights */}
      {insights.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Efficiency Insights
          </h2>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div
                key={i}
                className={`rounded-md px-3 py-2 text-sm ${
                  insight.type === "warning"
                    ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : insight.type === "success"
                      ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                }`}
              >
                {insight.type === "warning" && "⚠ "}
                {insight.type === "success" && "✓ "}
                {insight.type === "info" && "ℹ "}
                {insight.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Cost Trend */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Daily Cost Trend
        </h2>
        <CostTrendChart dailyCosts={summary.dailyCosts} />
      </div>

      {/* Model Breakdown */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Cost by Model
        </h2>
        <ModelBreakdownChart byModel={summary.byModel} />
      </div>

      {/* Efficiency Chart */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Per-User Efficiency
        </h2>
        <EfficiencyChart byUser={summary.byUser} teamMap={teamMap} />
      </div>

      {/* Per-User Breakdown Table */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Per-User Breakdown
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 pr-4 font-medium text-gray-600 dark:text-gray-400">
                  User
                </th>
                <SortableHeader
                  label="Cost"
                  sortKey="cost"
                  currentKey={sortKey}
                  indicator={sortIndicator("cost")}
                  onClick={() => handleSort("cost")}
                />
                <SortableHeader
                  label="Sessions"
                  sortKey="sessions"
                  currentKey={sortKey}
                  indicator={sortIndicator("sessions")}
                  onClick={() => handleSort("sessions")}
                />
                <SortableHeader
                  label="Cost/Sess"
                  sortKey="costPerSession"
                  currentKey={sortKey}
                  indicator={sortIndicator("costPerSession")}
                  onClick={() => handleSort("costPerSession")}
                />
                <th className="pb-2 pr-4 font-medium text-gray-600 dark:text-gray-400">
                  LOC +/-
                </th>
                <SortableHeader
                  label="Accept%"
                  sortKey="acceptance"
                  currentKey={sortKey}
                  indicator={sortIndicator("acceptance")}
                  onClick={() => handleSort("acceptance")}
                />
                <SortableHeader
                  label="Cache%"
                  sortKey="cache"
                  currentKey={sortKey}
                  indicator={sortIndicator("cache")}
                  onClick={() => handleSort("cache")}
                />
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <UserRow
                  key={user.email}
                  user={user}
                  displayName={resolveUserName(user.email, teamMap)}
                  expanded={expandedUser === user.email}
                  onToggle={() =>
                    setExpandedUser(
                      expandedUser === user.email ? null : user.email
                    )
                  }
                  dailyCosts={getUserDailyCosts(user.email)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Scope Notice */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        <p>
          ℹ 사용량은 Claude Code OTel 연동을 통해 수집됩니다. 모든 팀원이
          Claude Code에 OTel을 설정해야 개별 사용자별 데이터가 집계됩니다.
        </p>
        <p className="mt-1">
          LoC, commits, PRs는 Claude Code가 처리한 전체 합산이며 특정 repo에
          매핑되지 않습니다.
        </p>
      </div>
    </div>
  );
}

// --- Helper components ---

function SortableHeader({
  label,
  sortKey,
  currentKey,
  indicator,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  indicator: string;
  onClick: () => void;
}) {
  return (
    <th
      className={`cursor-pointer pb-2 pr-4 font-medium transition-colors ${
        currentKey === sortKey
          ? "text-purple-600 dark:text-purple-400"
          : "text-gray-600 dark:text-gray-400"
      }`}
      onClick={onClick}
    >
      {label}
      {indicator}
    </th>
  );
}

function EfficiencyIndicator({
  cache,
  accept,
}: {
  cache: number;
  accept: number;
}) {
  const color =
    cache > 0.5 && accept > 0.8
      ? "bg-green-500"
      : cache > 0.3 && accept > 0.6
        ? "bg-yellow-500"
        : "bg-red-500";

  return <span className={`ml-1 inline-block h-2 w-2 rounded-full ${color}`} />;
}

function UserRow({
  user,
  displayName,
  expanded,
  onToggle,
  dailyCosts,
}: {
  user: ClaudeCodeUserAggregation;
  displayName: string;
  expanded: boolean;
  onToggle: () => void;
  dailyCosts: { date: string; costCents: number }[];
}) {
  const costPerSession =
    user.sessions > 0 ? user.costCents / user.sessions : 0;

  return (
    <>
      <tr
        className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
        onClick={onToggle}
      >
        <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">
          <span className="flex items-center">
            <span className="mr-1 text-gray-400">{expanded ? "▼" : "▶"}</span>
            {displayName}
            <EfficiencyIndicator
              cache={user.cacheReadRatio}
              accept={user.acceptanceRate}
            />
          </span>
        </td>
        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
          {formatCost(user.costCents)}
        </td>
        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
          {formatNum(user.sessions)}
        </td>
        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
          {formatCost(costPerSession)}
        </td>
        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
          <span className="text-green-600">+{formatNum(user.locAdded)}</span>
          {" / "}
          <span className="text-red-600">-{formatNum(user.locRemoved)}</span>
        </td>
        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
          {formatPct(user.acceptanceRate)}
        </td>
        <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
          {formatPct(user.cacheReadRatio)}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-100 dark:border-gray-800">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Model mix */}
              <div>
                <h4 className="mb-2 text-xs font-medium text-gray-500">
                  Model Cost Breakdown
                </h4>
                <div className="space-y-1">
                  {user.modelBreakdown
                    .sort((a, b) => b.costCents - a.costCents)
                    .map((m) => {
                      const pct =
                        user.costCents > 0
                          ? (m.costCents / user.costCents) * 100
                          : 0;
                      return (
                        <div
                          key={m.model}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div className="w-28 truncate text-gray-600 dark:text-gray-400">
                            {m.model.replace(/^claude-/, "")}
                          </div>
                          <div className="flex-1">
                            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                              <div
                                className="h-2 rounded-full bg-purple-500"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="w-16 text-right text-gray-600 dark:text-gray-400">
                            {formatCost(m.costCents)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Daily cost mini trend */}
              <div>
                <h4 className="mb-2 text-xs font-medium text-gray-500">
                  Daily Cost Trend
                </h4>
                {dailyCosts.length > 0 ? (
                  <MiniCostTrend dailyCosts={dailyCosts} />
                ) : (
                  <p className="text-xs text-gray-400">No daily data</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Mini sparkline-style bar chart for per-user daily cost. */
function MiniCostTrend({
  dailyCosts,
}: {
  dailyCosts: { date: string; costCents: number }[];
}) {
  const maxCost = Math.max(...dailyCosts.map((d) => d.costCents), 1);

  return (
    <div className="flex items-end gap-0.5" style={{ height: 48 }}>
      {dailyCosts.map((d) => {
        const h = Math.max((d.costCents / maxCost) * 48, 2);
        return (
          <div
            key={d.date}
            className="flex-1 rounded-t bg-purple-400 dark:bg-purple-600"
            style={{ height: h }}
            title={`${d.date}: ${formatCost(d.costCents)}`}
          />
        );
      })}
    </div>
  );
}

// --- Formatting utils ---

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function formatNum(n: number): string {
  return n.toLocaleString();
}
