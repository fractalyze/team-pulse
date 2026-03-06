// Copyright 2026 Fractalyze Inc. All rights reserved.

/**
 * ISO week utilities. Week IDs use the format "YYYY-WNN".
 */

/** Get the ISO week number for a given date. */
export function getISOWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get the ISO week year for a given date. */
export function getISOWeekYear(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

/** Get the week ID (e.g. "2026-W10") for a given date. */
export function getWeekId(date: Date = new Date()): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Get the previous week ID. */
export function getPreviousWeekId(weekId: string): string {
  const [yearStr, weekStr] = weekId.split("-W");
  let year = parseInt(yearStr, 10);
  let week = parseInt(weekStr, 10);
  week -= 1;
  if (week < 1) {
    year -= 1;
    // ISO 8601: last week of year is either 52 or 53
    const dec28 = new Date(Date.UTC(year, 11, 28));
    week = getISOWeek(dec28);
  }
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Get Monday and Sunday dates for a given week ID. */
export function getWeekRange(weekId: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekId.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // 1=Mon, 7=Sun
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const start = new Date(mondayOfWeek1);
  start.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

/** Convert a week ID to its month (e.g. "2026-W10" → "2026-03"). */
export function weekIdToMonth(weekId: string): string {
  const { start } = getWeekRange(weekId);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Convert a week ID to its half-year (e.g. "2026-W10" → "2026-H1"). */
export function weekIdToHalf(weekId: string): string {
  const { start } = getWeekRange(weekId);
  const year = start.getUTCFullYear();
  const half = start.getUTCMonth() < 6 ? "H1" : "H2";
  return `${year}-${half}`;
}

/** Format a date as "M/D(요일)" in KST. */
export function formatDateKST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const dayName = days[kst.getUTCDay()];
  return `${month}/${day}(${dayName})`;
}
