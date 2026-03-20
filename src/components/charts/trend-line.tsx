// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { WeeklySnapshot, WeeklyPendingReviews } from "@/lib/types";
import { getMemberColor } from "@/lib/chart-colors";

interface TrendLineChartProps {
  snapshots: WeeklySnapshot[];
}

export function PRTrendChart({ snapshots }: TrendLineChartProps) {
  const data = snapshots.map((s) => ({
    week: s.weekId.replace(/^\d{4}-/, ""),
    merged: s.github.totalMerged,
    open: s.github.totalOpen,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="merged"
          stroke="#22c55e"
          name="Merged PRs"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="open"
          stroke="#f59e0b"
          name="Open PRs"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function VelocityTrendChart({ snapshots }: TrendLineChartProps) {
  const data = snapshots.map((s) => ({
    week: s.weekId.replace(/^\d{4}-/, ""),
    commits: s.github.totalCommits,
    merged: s.github.totalMerged,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis yAxisId="left" allowDecimals={false} />
        <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="commits"
          stroke="#3b82f6"
          name="Commits"
          strokeWidth={2}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="merged"
          stroke="#22c55e"
          name="Merged PRs"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ReviewLatencyTrendChart({ snapshots }: TrendLineChartProps) {
  const data = snapshots.map((s) => ({
    week: s.weekId.replace(/^\d{4}-/, ""),
    latency: s.github.reviewHealth.avgReviewLatencyHours ?? 0,
    unreviewed: s.github.reviewHealth.prsWithNoReview,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis yAxisId="left" allowDecimals={false} />
        <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="latency"
          stroke="#f59e0b"
          name="Avg Latency (h)"
          strokeWidth={2}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="unreviewed"
          stroke="#ef4444"
          name="Unreviewed Merges"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface ReviewByReviewerTrendChartProps {
  snapshots: WeeklySnapshot[];
  displayNames?: Record<string, string>;
}

export function ReviewByReviewerTrendChart({
  snapshots,
  displayNames = {},
}: ReviewByReviewerTrendChartProps) {
  const dn = (name: string) => displayNames[name] ?? name;

  // Collect all unique reviewers across all snapshots
  const allReviewers = new Set<string>();
  for (const s of snapshots) {
    for (const reviewer of Object.keys(s.github.reviewHealth.byReviewer)) {
      allReviewers.add(reviewer);
    }
  }

  const data = snapshots.map((s) => {
    const point: Record<string, string | number> = {
      week: s.weekId.replace(/^\d{4}-/, ""),
    };
    for (const reviewer of allReviewers) {
      point[reviewer] = s.github.reviewHealth.byReviewer[reviewer] ?? 0;
    }
    return point;
  });

  const reviewers = [...allReviewers];

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No review data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis allowDecimals={false} />
        <Tooltip
          formatter={(value, name) => [value, dn(String(name))]}
        />
        <Legend formatter={(value: string) => dn(value)} />
        {reviewers.map((reviewer, i) => (
          <Bar
            key={reviewer}
            dataKey={reviewer}
            stackId="reviews"
            fill={getMemberColor(dn(reviewer), i)}
            name={reviewer}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

interface DeadlineAccuracyPoint {
  weekId: string;
  onTimeRate: number;
  avgDeltaDays: number | null;
}

interface DeadlineAccuracyTrendChartProps {
  data: DeadlineAccuracyPoint[];
}

export function DeadlineAccuracyTrendChart({ data }: DeadlineAccuracyTrendChartProps) {
  const chartData = data.map((d) => ({
    week: d.weekId.replace(/^\d{4}-/, ""),
    onTimeRate: d.onTimeRate,
    avgDelta: d.avgDeltaDays ?? 0,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No deadline accuracy data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis yAxisId="left" domain={[0, 100]} allowDecimals={false} />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="onTimeRate"
          stroke="#22c55e"
          name="On-Time Rate (%)"
          strokeWidth={2}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="avgDelta"
          stroke="#f59e0b"
          name="Avg Delta (days)"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface PendingReviewTrendChartProps {
  pendingByWeek: Record<string, WeeklyPendingReviews>;
  weekIds: string[];
  displayNames?: Record<string, string>;
}

export function PendingReviewTrendChart({
  pendingByWeek,
  weekIds,
  displayNames = {},
}: PendingReviewTrendChartProps) {
  const dn = (name: string) => displayNames[name] ?? name;
  const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const DAY_LABELS: Record<string, string> = {
    Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금",
  };

  // Collect all reviewers across all weeks
  const allReviewers = new Set<string>();
  for (const weekId of weekIds) {
    const pending = pendingByWeek[weekId];
    if (!pending) continue;
    for (const entry of pending.entries) {
      for (const reviewer of Object.keys(entry.byReviewer)) {
        allReviewers.add(reviewer);
      }
    }
  }
  const reviewers = [...allReviewers];

  // Build chart data: one bar group per day across all weeks
  const data: Record<string, string | number>[] = [];
  for (const weekId of weekIds) {
    const pending = pendingByWeek[weekId];
    if (!pending) continue;
    const weekLabel = weekId.replace(/^\d{4}-/, "");
    const sorted = pending.entries
      .filter((e) => DAY_ORDER.includes(e.day))
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
    for (const entry of sorted) {
      const point: Record<string, string | number> = {
        label: `${weekLabel} ${DAY_LABELS[entry.day] ?? entry.day}`,
      };
      for (const reviewer of reviewers) {
        point[reviewer] = entry.byReviewer[reviewer] ?? 0;
      }
      data.push(point);
    }
  }

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No pending review data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" fontSize={10} angle={-30} textAnchor="end" height={50} />
        <YAxis allowDecimals={false} />
        <Tooltip
          formatter={(value, name) => [value, dn(String(name))]}
        />
        <Legend formatter={(value: string) => dn(value)} />
        {reviewers.map((reviewer, i) => (
          <Bar
            key={reviewer}
            dataKey={reviewer}
            stackId="pending"
            fill={getMemberColor(dn(reviewer), i)}
            name={reviewer}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

