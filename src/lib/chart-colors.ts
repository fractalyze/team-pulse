// Copyright 2026 Fractalyze Inc. All rights reserved.

/** Consistent per-member colors used across all charts. */
export const MEMBER_COLORS: Record<string, string> = {
  Ryan: "#3b82f6",
  Soowon: "#22c55e",
  Baz: "#f59e0b",
  Jun: "#8b5cf6",
  Jooman: "#ef4444",
};

export const FALLBACK_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#ec4899", "#14b8a6",
];

/** Get a consistent color for a member name. */
export function getMemberColor(name: string, index: number): string {
  return MEMBER_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}
