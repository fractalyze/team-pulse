// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useState } from "react";

interface TriggerResult {
  status: "idle" | "loading" | "success" | "error";
  data?: unknown;
  error?: string;
}

interface Trigger {
  id: string;
  label: string;
  description: string;
  actions: string[];
  saveActions?: string[];
  group: "test" | "collect";
}

const TRIGGERS: Trigger[] = [
  {
    id: "test-team",
    label: "Team Discovery",
    description: "GitHub org members",
    actions: ["test-team"],
    group: "test",
  },
  {
    id: "github",
    label: "GitHub",
    description: "PRs, commits, review health per repo",
    actions: ["collect-github"],
    saveActions: ["save-github"],
    group: "collect",
  },
  {
    id: "notion",
    label: "Notion Context Sync",
    description: "Meeting notes, action items, decisions",
    actions: ["collect-notion"],
    saveActions: ["save-notion"],
    group: "collect",
  },
];

const GROUP_LABELS: Record<string, string> = {
  test: "Connection Test",
  collect: "Data Collection",
};

const GROUPS = ["test", "collect"] as const;

export function AdminPanel() {
  const [results, setResults] = useState<Record<string, TriggerResult>>({});

  async function runTrigger(id: string, actions: string[]) {
    setResults((prev) => ({ ...prev, [id]: { status: "loading" } }));

    try {
      const res = await fetch("/api/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCronSecret()}`,
        },
        body: JSON.stringify({ actions }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResults((prev) => ({
          ...prev,
          [id]: {
            status: "error",
            error: data.error || data.details || `HTTP ${res.status}`,
          },
        }));
      } else {
        setResults((prev) => ({ ...prev, [id]: { status: "success", data } }));
      }
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [id]: { status: "error", error: String(e) },
      }));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Admin
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          데이터 소스별 수동 트리거 및 연동 테스트
        </p>
      </div>

      {/* CRON_SECRET input */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          CRON_SECRET
        </label>
        <input
          id="cron-secret"
          type="password"
          placeholder="Bearer token for API auth"
          defaultValue={
            typeof window !== "undefined"
              ? localStorage.getItem("cron-secret") ?? ""
              : ""
          }
          onChange={(e) => localStorage.setItem("cron-secret", e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>

      {/* Grouped trigger buttons */}
      {GROUPS.map((group) => (
        <div key={group}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {GROUP_LABELS[group]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRIGGERS.filter((t) => t.group === group).map((trigger) => {
              const runResult = results[trigger.id] ?? { status: "idle" };
              const saveKey = `${trigger.id}-save`;
              const saveResult = results[saveKey] ?? { status: "idle" };
              const isRunning = runResult.status === "loading";
              const isSaving = saveResult.status === "loading";

              return (
                <div
                  key={trigger.id}
                  className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900"
                >
                  <div className="mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {trigger.label}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {trigger.description}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        runTrigger(trigger.id, trigger.actions)
                      }
                      disabled={isRunning || isSaving}
                      className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isRunning ? "Running..." : "Run"}
                    </button>
                    {trigger.saveActions && (
                      <button
                        onClick={() =>
                          runTrigger(saveKey, trigger.saveActions!)
                        }
                        disabled={isRunning || isSaving}
                        className="flex-1 rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    )}
                  </div>

                  {/* Show run result */}
                  {runResult.status === "success" && (
                    <pre className="mt-3 max-h-60 overflow-auto rounded bg-green-50 p-2 text-xs text-green-800 dark:bg-green-950 dark:text-green-300">
                      {JSON.stringify(runResult.data, null, 2)}
                    </pre>
                  )}
                  {runResult.status === "error" && (
                    <pre className="mt-3 max-h-60 overflow-auto rounded bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-300">
                      {runResult.error}
                    </pre>
                  )}
                  {/* Show save result */}
                  {saveResult.status === "success" && (
                    <pre className="mt-3 max-h-60 overflow-auto rounded bg-blue-50 p-2 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {JSON.stringify(saveResult.data, null, 2)}
                    </pre>
                  )}
                  {saveResult.status === "error" && (
                    <pre className="mt-3 max-h-60 overflow-auto rounded bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-300">
                      {saveResult.error}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function getCronSecret(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("cron-secret") ?? "";
}
