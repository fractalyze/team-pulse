// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { KnowledgeMetrics } from "@/lib/types";

interface KnowledgeDonutProps {
  knowledge: KnowledgeMetrics;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];
const CATEGORY_LABELS: Record<string, string> = {
  concepts: "Concepts",
  conventions: "Conventions",
  decisions: "Decisions",
  pitfalls: "Pitfalls",
};

export function KnowledgeDonut({ knowledge }: KnowledgeDonutProps) {
  const data = Object.entries(knowledge.byCategory)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({
      name: CATEGORY_LABELS[category] ?? category,
      value: count,
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No knowledge updates this week
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
