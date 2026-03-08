// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useState, useEffect } from "react";

interface OtelStatus {
  email: string;
  lastSeen: string;
  totalDataPoints: number;
}

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
  group: "test" | "collect" | "send";
}

const TRIGGERS: Trigger[] = [
  {
    id: "test-team",
    label: "Team Discovery",
    description: "GitHub org members + Slack user matching",
    actions: ["test-team"],
    group: "test",
  },
  {
    id: "test-gcal",
    label: "Google Calendar",
    description: "Check if Weekly Sync event exists today",
    actions: ["test-gcal"],
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
  {
    id: "slack",
    label: "Slack Channel",
    description: "Send weekly summary to channel",
    actions: ["slack"],
    group: "send",
  },
  {
    id: "dm",
    label: "Slack DMs",
    description: "Send individual prep DMs to team members",
    actions: ["dm"],
    group: "send",
  },
  {
    id: "notion-page",
    label: "Notion Page",
    description: "Create weekly sync meeting note",
    actions: ["notion"],
    group: "send",
  },
];

const GROUP_LABELS: Record<string, string> = {
  test: "Connection Test",
  collect: "Data Collection",
  send: "Output",
};

const GROUPS = ["test", "collect", "send"] as const;

export function AdminPanel() {
  const [results, setResults] = useState<Record<string, TriggerResult>>({});
  const [otelConfigured, setOtelConfigured] = useState<boolean | null>(null);
  const [otelStatuses, setOtelStatuses] = useState<OtelStatus[]>([]);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    const secret = getCronSecret();
    if (!secret) return;
    fetch("/api/otel/status", {
      headers: { Authorization: `Bearer ${secret}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setOtelConfigured(data.configured);
          setOtelStatuses(data.statuses);
        }
      })
      .catch(() => {});
  }, []);

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

      {/* OTel Connection Status */}
      <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Claude Code OTel
            </h2>
            <p className="text-xs text-gray-400">
              모든 팀원이 OTel을 설정하면 개별 사용자별 사용량이 수집됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                otelConfigured ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            <span className="text-gray-500">
              {otelConfigured === null
                ? "Loading..."
                : otelConfigured
                  ? "OTEL_INGEST_TOKEN configured"
                  : "OTEL_INGEST_TOKEN not set"}
            </span>
          </div>
        </div>

        {otelStatuses.length > 0 ? (
          <div className="mb-3 space-y-2">
            {otelStatuses.map((s) => (
              <div
                key={s.email}
                className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  {s.email}
                </span>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>
                    Last seen:{" "}
                    {new Date(s.lastSeen).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </span>
                  <span>{s.totalDataPoints.toLocaleString()} data points</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-400">
            No OTel connections yet.
          </p>
        )}

        <button
          onClick={() => setShowSetup(!showSetup)}
          className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
        >
          {showSetup ? "Hide" : "Show"} Setup Instructions
        </button>

        {showSetup && (
          <pre className="mt-2 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
{`// ~/.claude/settings.json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://<team-pulse-url>/api/otel",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer <OTEL_INGEST_TOKEN>",
    "OTEL_METRIC_EXPORT_INTERVAL": "3600000"
  }
}
// 3600000ms = 1시간. Upstash 무료 범위 유지를 위해 권장.`}
          </pre>
        )}
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
