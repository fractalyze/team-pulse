// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { WeeklySnapshot } from "@/lib/types";
import { getMemberColor } from "@/lib/chart-colors";

interface VelocityBarChartProps {
  snapshots: WeeklySnapshot[];
}

export function VelocityBarChart({ snapshots }: VelocityBarChartProps) {
  // Collect all unique authors across all snapshots
  const allAuthors = new Set<string>();
  for (const s of snapshots) {
    for (const author of Object.keys(s.github.byAuthor)) {
      if (s.github.byAuthor[author].merged > 0) {
        allAuthors.add(author);
      }
    }
  }

  const data = snapshots.map((s) => {
    const point: Record<string, string | number> = {
      week: s.weekId.replace(/^\d{4}-/, ""),
    };
    for (const author of allAuthors) {
      point[author] = s.github.byAuthor[author]?.merged ?? 0;
    }
    return point;
  });

  const authors = [...allAuthors];

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No velocity data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        {authors.map((author, i) => (
          <Bar
            key={author}
            dataKey={author}
            stackId="velocity"
            fill={getMemberColor(author, i)}
            name={author}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
