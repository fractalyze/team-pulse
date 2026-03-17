// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  GoalStatus,
  HalfYearObjective,
  MonthlyGoal,
  WeeklyTask,
  TeamMember,
  ProjectItem,
} from "@/lib/types";
import { weekIdToMonth, getWeekRange } from "@/lib/week";

type Tab = "half" | "month" | "week";

const STATUS_ICON: Record<GoalStatus, string> = {
  done: "\u2713",
  in_progress: "\u25D0",
  not_started: "\u25CB",
  closed: "\u2715",
};
const STATUS_COLOR: Record<GoalStatus, string> = {
  done: "text-green-500",
  in_progress: "text-blue-500",
  not_started: "text-gray-400",
  closed: "text-red-400",
};
const STATUS_LABEL: Record<GoalStatus, string> = {
  not_started: "To Do",
  in_progress: "In Progress",
  done: "Done",
  closed: "Closed",
};
const ALL_STATUSES: GoalStatus[] = ["not_started", "in_progress", "done", "closed"];

function currentHalf(): string {
  const now = new Date();
  const year = now.getFullYear();
  const half = now.getMonth() < 6 ? "H1" : "H2";
  return `${year}-${half}`;
}

function currentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function currentWeekId(): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function prevWeekId(weekId: string): string {
  const [yearStr, weekStr] = weekId.split("-W");
  let year = parseInt(yearStr, 10);
  let week = parseInt(weekStr, 10) - 1;
  if (week < 1) {
    year -= 1;
    const dec28 = new Date(Date.UTC(year, 11, 28));
    const d = new Date(
      Date.UTC(dec28.getFullYear(), dec28.getMonth(), dec28.getDate())
    );
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    week = Math.ceil(((d.getTime() - ys.getTime()) / 86400000 + 1) / 7);
  }
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function GoalsPanel() {
  const [tab, setTab] = useState<Tab>("half");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Goals
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          반기 / 월간 / 주간 목표 관리
        </p>
        <p className="mt-1 text-xs text-gray-400">
          개발 목표는 GitHub Projects에서 관리됩니다. 여기서는 비개발 목표만 편집할 수 있습니다.
        </p>
      </div>

      <div className="flex gap-1">
        {(["half", "month", "week"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {t === "half" ? "반기" : t === "month" ? "월간" : "주간"}
          </button>
        ))}
      </div>

      {tab === "half" && <HalfYearTab />}
      {tab === "month" && <MonthlyTab />}
      {tab === "week" && <WeeklyTab />}
    </div>
  );
}

// --- Half-Year Tab ---

function HalfYearTab() {
  const [period, setPeriod] = useState(currentHalf());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/goals?tier=half&period=${period}`);
    const { data } = await res.json();
    if (data) {
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
    } else {
      setTitle("");
      setDescription("");
    }
    setLoaded(true);
  }, [period]);

  useEffect(() => {
    setLoaded(false);
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "half", period, title, description }),
    });
    setSaving(false);
  }

  const year = new Date().getFullYear();
  const periods = [
    `${year}-H1`,
    `${year}-H2`,
    `${year + 1}-H1`,
    `${year + 1}-H2`,
  ];

  if (!loaded) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Period
        </label>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="반기 목표 제목"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="설명 (선택)"
        rows={2}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      />
      <button
        onClick={save}
        disabled={saving || !title.trim()}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

// --- Monthly Tab ---

function SyncBanner() {
  return (
    <div className="mb-3 rounded bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      Synced from GitHub Projects &mdash; fractalyze Roadmap #6
    </div>
  );
}

/** Compute monthly goal status from linked weekly tasks. */
function computeGoalStatus(tasks: WeeklyTask[], fallback: GoalStatus): GoalStatus {
  if (tasks.length === 0) return fallback;
  if (tasks.some((t) => t.status === "in_progress")) return "in_progress";
  if (tasks.every((t) => t.status === "done")) return "done";
  if (tasks.every((t) => t.status === "closed")) return "closed";
  if (tasks.every((t) => t.status === "done" || t.status === "closed"))
    return "done";
  if (tasks.some((t) => t.status !== "not_started")) return "in_progress";
  return "not_started";
}

function MonthlyTab() {
  const [month, setMonth] = useState(currentMonth());
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [ghGoals, setGhGoals] = useState<MonthlyGoal[]>([]);
  const [weeklyTasks, setWeeklyTasks] = useState<WeeklyTask[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    // Fetch monthly goals and all weekly tasks for this month's weeks
    const res = await fetch(`/api/goals?tier=month&month=${month}`);
    const { data } = await res.json();
    const all: MonthlyGoal[] = data ?? [];
    setGoals(all.filter((g) => g.source !== "github"));
    setGhGoals(all.filter((g) => g.source === "github"));

    // Fetch all week IDs and filter to this month, then fetch tasks
    const weeksRes = await fetch("/api/goals?tier=weeks");
    const { data: allWeeks } = await weeksRes.json();
    const monthWeeks = (allWeeks as string[] ?? []).filter(
      (w) => weekIdToMonth(w) === month
    );
    const taskResults = await Promise.all(
      monthWeeks.map((w) =>
        fetch(`/api/goals?tier=week&weekId=${w}`).then((r) => r.json())
      )
    );
    const allTasks: WeeklyTask[] = taskResults.flatMap((r) => r.data ?? []);
    setWeeklyTasks(allTasks);

    setLoaded(true);
  }, [month]);

  useEffect(() => {
    setLoaded(false);
    load();
  }, [load]);

  async function save(updatedGoals: MonthlyGoal[]) {
    setSaving(true);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "month", month, goals: updatedGoals }),
    });
    setSaving(false);
  }

  function addGoal() {
    const newGoal: MonthlyGoal = {
      id: crypto.randomUUID(),
      month,
      title: "",
      status: "not_started",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setGoals([...goals, newGoal]);
  }

  function updateGoal(id: string, updates: Partial<MonthlyGoal>) {
    setGoals(
      goals.map((g) =>
        g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
      )
    );
  }

  function removeGoal(id: string) {
    setGoals(goals.filter((g) => g.id !== id));
  }

  // Build goalId → tasks map for auto-status
  const goalTaskMap = new Map<string, WeeklyTask[]>();
  for (const task of weeklyTasks) {
    if (task.goalId) {
      if (!goalTaskMap.has(task.goalId)) goalTaskMap.set(task.goalId, []);
      goalTaskMap.get(task.goalId)!.push(task);
    }
  }

  if (!loaded) return <p className="text-sm text-gray-500">Loading...</p>;

  // Combine all goals for display: manual first, then GitHub
  const allGoals = [...goals, ...ghGoals];

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
      <SyncBanner />
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Month
        </label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>

      <div className="space-y-2">
        {allGoals.map((goal) => {
          const isGh = goal.source === "github";
          const linkedTasks = goalTaskMap.get(goal.id) ?? [];
          const autoStatus = linkedTasks.length > 0
            ? computeGoalStatus(linkedTasks, goal.status)
            : goal.status;
          const displayStatus = isGh ? autoStatus : goal.status;

          return (
            <div key={goal.id} className="flex items-center gap-2">
              {isGh ? (
                <span
                  className={`text-lg ${STATUS_COLOR[displayStatus]}`}
                  title={`${displayStatus} (auto-computed from ${linkedTasks.length} tasks)`}
                >
                  {STATUS_ICON[displayStatus]}
                </span>
              ) : (
                <select
                  value={goal.status}
                  onChange={(e) =>
                    updateGoal(goal.id, { status: e.target.value as GoalStatus })
                  }
                  className={`rounded border border-gray-300 px-1 py-0.5 text-xs ${STATUS_COLOR[goal.status]} dark:border-gray-700 dark:bg-gray-800`}
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              )}
              {isGh && (
                <span className="rounded bg-gray-800 px-1 py-0.5 text-[9px] text-gray-200">
                  DEV
                </span>
              )}
              {isGh ? (
                goal.githubUrl ? (
                  <a
                    href={goal.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-gray-700 hover:text-blue-500 dark:text-gray-300"
                  >
                    {goal.title}
                  </a>
                ) : (
                  <span className="flex-1 text-sm text-gray-500">{goal.title}</span>
                )
              ) : (
                <input
                  type="text"
                  value={goal.title}
                  onChange={(e) => updateGoal(goal.id, { title: e.target.value })}
                  placeholder="목표 제목"
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
              )}
              {isGh && linkedTasks.length > 0 && (
                <span className="text-xs text-gray-400">
                  {linkedTasks.filter((t) => t.status === "done").length}/{linkedTasks.length}
                </span>
              )}
              {!isGh && (
                <button
                  onClick={() => removeGoal(goal.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={addGoal}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
        >
          + Add
        </button>
        <button
          onClick={() => save(goals)}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

// --- Weekly Tab ---

function weekLabel(wId: string): string {
  const { start, end } = getWeekRange(wId);
  const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `${fmt(start)}-${fmt(end)}`;
}

/** Status badge for project items (PRs). */
function PRStatusBadge({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    Merged: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    "In Review": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    Draft: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    Closed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
  const s = status ?? "Unknown";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[s] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
      {s}
    </span>
  );
}

function WeeklyTab() {
  const [weekId, setWeekId] = useState(currentWeekId());
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [projectItems, setProjectItems] = useState<ProjectItem[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const dn = (name: string) => displayNames[name] ?? name;

  // Load weeks list and display names once
  useEffect(() => {
    fetch("/api/goals?tier=weeks")
      .then((r) => r.json())
      .then((json) => setAvailableWeeks(json.data ?? []));
    fetch("/api/goals?tier=displaynames")
      .then((r) => r.json())
      .then((json) => setDisplayNames(json.data ?? {}));
  }, []);

  const load = useCallback(async () => {
    const month = weekIdToMonth(weekId);
    const [tasksRes, teamRes, goalsRes, snapshotRes] = await Promise.all([
      fetch(`/api/goals?tier=week&weekId=${weekId}`),
      fetch("/api/goals?tier=team"),
      fetch(`/api/goals?tier=month&month=${month}`),
      fetch(`/api/data?type=summary&weekId=${weekId}`),
    ]);
    const { data: tasksData } = await tasksRes.json();
    const { data: teamData } = await teamRes.json();
    const { data: goalsData } = await goalsRes.json();
    setTasks(tasksData ?? []);
    setTeam(teamData ?? []);
    setMonthlyGoals(goalsData ?? []);
    // Extract project items from snapshot
    try {
      const snapshot = await snapshotRes.json();
      setProjectItems(snapshot?.current?.project?.items ?? []);
    } catch {
      setProjectItems([]);
    }
    setLoaded(true);
  }, [weekId]);

  useEffect(() => {
    setLoaded(false);
    load();
  }, [load]);

  async function save(updatedTasks: WeeklyTask[]) {
    setSaving(true);
    const manualTasks = updatedTasks.filter((t) => t.source !== "github");
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "week", weekId, tasks: manualTasks }),
    });
    const ghTasks = updatedTasks.filter((t) => t.source === "github");
    await Promise.all(
      ghTasks.map((t) =>
        fetch("/api/goals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier: "week",
            weekId,
            id: t.id,
            status: t.status,
            startDate: t.startDate ?? "",
            deadline: t.deadline,
          }),
        })
      )
    );
    setSaving(false);
  }

  function addTask(assignee: string) {
    const newTask: WeeklyTask = {
      id: crypto.randomUUID(),
      weekId,
      assignee,
      content: "",
      deadline: "",
      status: "not_started",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks([...tasks, newTask]);
  }

  function updateTask(id: string, updates: Partial<WeeklyTask>) {
    setTasks(
      tasks.map((t) =>
        t.id === id
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t
      )
    );
  }

  function removeTask(id: string) {
    setTasks(tasks.filter((t) => t.id !== id));
  }

  async function copyFromPrevWeek() {
    const prev = prevWeekId(weekId);
    const res = await fetch(`/api/goals?tier=week&weekId=${prev}`);
    const { data } = await res.json();
    if (!data || data.length === 0) return;
    const incomplete = (data as WeeklyTask[]).filter(
      (t) => t.status !== "done" && t.status !== "closed"
    );
    const existingIds = new Set(tasks.map((t) => t.id));
    const carried = incomplete
      .filter((t) => !existingIds.has(t.id))
      .map((t) => ({
        ...t,
        weekId,
        updatedAt: new Date().toISOString(),
      }));
    setTasks([...tasks, ...carried]);
  }

  if (!loaded) return <p className="text-sm text-gray-500">Loading...</p>;

  // Build hierarchy: Monthly Goal → Weekly Goal → PRs
  // 1. Group weekly goals (github tasks) by goalId (monthly goal)
  const ghTasks = tasks.filter((t) => t.source === "github");
  const manualTasks = tasks.filter((t) => t.source !== "github");

  // Build PR lookup by weeklyGoal title
  const prsByWeeklyGoal = new Map<string, ProjectItem[]>();
  for (const item of projectItems) {
    if (item.level !== "Weekly Task" || !item.weeklyGoal) continue;
    if (!prsByWeeklyGoal.has(item.weeklyGoal))
      prsByWeeklyGoal.set(item.weeklyGoal, []);
    prsByWeeklyGoal.get(item.weeklyGoal)!.push(item);
  }

  // Group gh tasks by monthly goal
  const tasksByMonthlyGoal = new Map<string, WeeklyTask[]>();
  const ungroupedGhTasks: WeeklyTask[] = [];
  for (const t of ghTasks) {
    if (t.goalId) {
      if (!tasksByMonthlyGoal.has(t.goalId))
        tasksByMonthlyGoal.set(t.goalId, []);
      tasksByMonthlyGoal.get(t.goalId)!.push(t);
    } else {
      ungroupedGhTasks.push(t);
    }
  }

  // Order monthly goals: those with linked tasks first
  const goalsWithTasks = monthlyGoals.filter(
    (g) => tasksByMonthlyGoal.has(g.id)
  );

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
      <SyncBanner />
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Week
        </label>
        <select
          value={weekId}
          onChange={(e) => setWeekId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          {availableWeeks.map((w) => (
            <option key={w} value={w}>
              {w} &middot; {weekLabel(w)}
            </option>
          ))}
        </select>
        <button
          onClick={copyFromPrevWeek}
          className="rounded bg-yellow-100 px-3 py-1 text-sm text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300"
        >
          Copy incomplete from prev week
        </button>
      </div>

      {/* Hierarchical view: Monthly Goal → Weekly Goal → PRs */}
      {goalsWithTasks.map((goal) => {
        const weeklyGoals = tasksByMonthlyGoal.get(goal.id) ?? [];
        return (
          <div
            key={goal.id}
            className="rounded-lg border border-gray-200 dark:border-gray-700"
          >
            {/* Monthly Goal header */}
            <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-2 dark:border-gray-800 dark:bg-gray-800/30">
              <div className="flex items-center gap-2">
                <span className={`text-sm ${STATUS_COLOR[goal.status]}`}>
                  {STATUS_ICON[goal.status]}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {goal.title}
                </span>
                {goal.source === "github" && (
                  <span className="rounded bg-gray-800 px-1 py-0.5 text-[9px] text-gray-200">
                    DEV
                  </span>
                )}
                <span className="text-xs text-gray-400">Monthly Goal</span>
              </div>
            </div>

            {/* Weekly Goals under this monthly goal */}
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {weeklyGoals.map((task) => {
                const linkedPRs = prsByWeeklyGoal.get(task.content) ?? [];
                return (
                  <div key={task.id} className="px-4 py-2.5">
                    {/* Weekly Goal row */}
                    <div className="flex items-center gap-2">
                      <select
                        value={task.status}
                        onChange={(e) =>
                          updateTask(task.id, {
                            status: e.target.value as GoalStatus,
                          })
                        }
                        className={`rounded border border-gray-300 px-1 py-0.5 text-xs ${STATUS_COLOR[task.status]} dark:border-gray-700 dark:bg-gray-800`}
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <span className="rounded bg-gray-800 px-1 py-0.5 text-[9px] text-gray-200">
                        DEV
                      </span>
                      {task.githubUrl ? (
                        <a
                          href={task.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-900 hover:text-blue-500 dark:text-white"
                        >
                          {task.content}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {task.content}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {dn(task.assignee)}
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        <input
                          type="date"
                          value={task.startDate ?? ""}
                          onChange={(e) =>
                            updateTask(task.id, {
                              startDate: e.target.value || undefined,
                            })
                          }
                          title="Start date"
                          className="w-32 rounded border border-gray-300 px-1.5 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        />
                        <input
                          type="date"
                          value={task.deadline}
                          onChange={(e) =>
                            updateTask(task.id, { deadline: e.target.value })
                          }
                          title="Deadline"
                          className="w-32 rounded border border-gray-300 px-1.5 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        />
                      </div>
                    </div>

                    {/* Linked PRs */}
                    {linkedPRs.length > 0 && (
                      <div className="ml-6 mt-1.5 space-y-0.5">
                        {linkedPRs.map((pr) => (
                          <div
                            key={pr.id}
                            className="flex items-center gap-2 text-xs text-gray-500"
                          >
                            <PRStatusBadge status={pr.status} />
                            {pr.url ? (
                              <a
                                href={pr.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {pr.repo}#{pr.number}
                              </a>
                            ) : (
                              <span>&mdash;</span>
                            )}
                            <span className="truncate text-gray-600 dark:text-gray-400">
                              {pr.title}
                            </span>
                            <span className="ml-auto text-gray-400">
                              {pr.assignees.length > 0
                                ? pr.assignees.map(dn).join(", ")
                                : dn(pr.author ?? "")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Ungrouped GitHub tasks (no monthly goal link) */}
      {ungroupedGhTasks.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-2 dark:border-gray-800 dark:bg-gray-800/30">
            <span className="text-sm font-semibold text-gray-500">
              Ungrouped Weekly Goals
            </span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {ungroupedGhTasks.map((task) => {
              const linkedPRs = prsByWeeklyGoal.get(task.content) ?? [];
              return (
                <div key={task.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <select
                      value={task.status}
                      onChange={(e) =>
                        updateTask(task.id, {
                          status: e.target.value as GoalStatus,
                        })
                      }
                      className={`rounded border border-gray-300 px-1 py-0.5 text-xs ${STATUS_COLOR[task.status]} dark:border-gray-700 dark:bg-gray-800`}
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <span className="rounded bg-gray-800 px-1 py-0.5 text-[9px] text-gray-200">
                      DEV
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {task.content}
                    </span>
                    <span className="text-xs text-gray-400">
                      {dn(task.assignee)}
                    </span>
                  </div>
                  {linkedPRs.length > 0 && (
                    <div className="ml-6 mt-1.5 space-y-0.5">
                      {linkedPRs.map((pr) => (
                        <div
                          key={pr.id}
                          className="flex items-center gap-2 text-xs text-gray-500"
                        >
                          <PRStatusBadge status={pr.status} />
                          {pr.url ? (
                            <a
                              href={pr.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {pr.repo}#{pr.number}
                            </a>
                          ) : (
                            <span>&mdash;</span>
                          )}
                          <span className="truncate text-gray-600 dark:text-gray-400">
                            {pr.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual tasks section */}
      {manualTasks.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-2 dark:border-gray-800 dark:bg-gray-800/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-500">
                Manual Tasks
              </span>
              <button
                onClick={() => addTask(team[0]?.name ?? "unassigned")}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                + Add
              </button>
            </div>
          </div>
          <div className="space-y-1.5 px-4 py-2.5">
            {manualTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2">
                <select
                  value={task.status}
                  onChange={(e) =>
                    updateTask(task.id, {
                      status: e.target.value as GoalStatus,
                    })
                  }
                  className={`rounded border border-gray-300 px-1 py-0.5 text-xs ${STATUS_COLOR[task.status]} dark:border-gray-700 dark:bg-gray-800`}
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={task.content}
                  onChange={(e) =>
                    updateTask(task.id, { content: e.target.value })
                  }
                  placeholder="Task content"
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
                <input
                  type="date"
                  value={task.startDate ?? ""}
                  onChange={(e) =>
                    updateTask(task.id, {
                      startDate: e.target.value || undefined,
                    })
                  }
                  title="Start date"
                  className="w-32 rounded border border-gray-300 px-1.5 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
                <input
                  type="date"
                  value={task.deadline}
                  onChange={(e) =>
                    updateTask(task.id, { deadline: e.target.value })
                  }
                  title="Deadline"
                  className="w-32 rounded border border-gray-300 px-1.5 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
                <select
                  value={task.goalId ?? ""}
                  onChange={(e) =>
                    updateTask(task.id, {
                      goalId: e.target.value || undefined,
                    })
                  }
                  className="w-32 truncate rounded border border-gray-300 px-1.5 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="">No goal</option>
                  {monthlyGoals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeTask(task.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add manual task when no manual tasks exist */}
      {manualTasks.length === 0 && (
        <button
          onClick={() => addTask(team[0]?.name ?? "unassigned")}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
        >
          + Add manual task
        </button>
      )}

      <button
        onClick={() => save(tasks)}
        disabled={saving}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
