// Copyright 2026 Fractalyze Inc. All rights reserved.

export const ORG = "fractalyze";

export const MONITORED_REPOS = [
  "zkx",
  "prime-ir",
  "jax",
  "whir-zorch",
  "stablehlo",
  "riscv-witness",
  "zk_dtypes",
  "zkx-gpu",
  "rabbitsnark-py",
];

// Notion IDs
export const CONTEXT_SYNC_DB = "2ffa84235e5680d2adf2fe3b44eddf32";

// Slack
export const SLACK_CHANNEL = process.env.SLACK_CHANNEL_ID ?? "";

// Calendar
export const WEEKLY_SYNC_EVENT_NAME = "Weekly Compiler Meeting";

// Dashboard
export const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "https://team-pulse.vercel.app";
