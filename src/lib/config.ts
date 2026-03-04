// Copyright 2026 Fractalyze Inc. All rights reserved.

import type { RepoOKRMapping } from "./types";

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

export const OKR_REPO_MAP: RepoOKRMapping = {
  zkx: "OBJ1: GPU E2E Pipeline",
  "prime-ir": "OBJ1: GPU E2E Pipeline",
  "whir-zorch": "OBJ1: GPU E2E Pipeline",
  jax: "OBJ1: GPU E2E Pipeline",
  stablehlo: "OBJ1: GPU E2E Pipeline",
  zk_dtypes: "OBJ1: GPU E2E Pipeline",
  "zkx-gpu": "OBJ1: GPU E2E Pipeline",
  "riscv-witness": "Infra/Tooling",
  "rabbitsnark-py": "OBJ1: GPU E2E Pipeline",
};

// Notion IDs
export const CONTEXT_SYNC_DB = "2ffa84235e5680d2adf2fe3b44eddf32";
export const OKR_PAGE_ID = "2c9a84235e56807da72bfd015ac8edcc";
export const WEEKLY_GOAL_PAGE = "71ed54f79d3d46c58ceaa8cf9bc6321b";

// Slack
export const SLACK_CHANNEL = process.env.SLACK_CHANNEL_ID ?? "";

// Calendar
export const WEEKLY_SYNC_EVENT_NAME = "Weekly Sync";

// Dashboard
export const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "https://team-pulse.vercel.app";
