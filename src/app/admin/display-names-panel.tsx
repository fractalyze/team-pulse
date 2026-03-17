// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useState, useEffect, useCallback } from "react";

interface Entry {
  github: string;
  displayName: string;
}

export function DisplayNamesPanel() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/goals?tier=displaynames");
    const { data } = await res.json();
    const map: Record<string, string> = data ?? {};
    setEntries(
      Object.entries(map).map(([github, displayName]) => ({
        github,
        displayName,
      }))
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function addEntry() {
    setEntries([...entries, { github: "", displayName: "" }]);
  }

  function updateEntry(index: number, updates: Partial<Entry>) {
    setEntries(
      entries.map((e, i) => (i === index ? { ...e, ...updates } : e))
    );
  }

  function removeEntry(index: number) {
    setEntries(entries.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    const map: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.github.trim() && entry.displayName.trim()) {
        map[entry.github.trim()] = entry.displayName.trim();
      }
    }
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "displaynames", map }),
    });
    setSaving(false);
  }

  if (!loaded) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Display Names
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          GitHub username → 표시 이름 매핑
        </p>
      </div>

      <div className="space-y-2 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={entry.github}
              onChange={(e) => updateEntry(i, { github: e.target.value })}
              placeholder="GitHub username"
              className="w-40 rounded border border-gray-300 px-2 py-1 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <span className="text-gray-400">→</span>
            <input
              type="text"
              value={entry.displayName}
              onChange={(e) =>
                updateEntry(i, { displayName: e.target.value })
              }
              placeholder="Display name"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <button
              onClick={() => removeEntry(i)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              x
            </button>
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <button
            onClick={addEntry}
            className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
          >
            + Add
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
