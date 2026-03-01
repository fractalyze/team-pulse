// Copyright 2026 Fractalyze Inc. All rights reserved.

import { google } from "googleapis";
import { WEEKLY_SYNC_EVENT_NAME } from "../config";

/** Check if today has a Weekly Sync event on the configured calendar. */
export async function hasWeeklySyncToday(): Promise<boolean> {
  const credentials = process.env.GOOGLE_CREDENTIALS;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!credentials || !calendarId) {
    console.warn(
      "Google Calendar credentials not configured, skipping calendar check"
    );
    return false;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  // Get today's range in KST (UTC+9)
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const todayStart = new Date(
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate()
    )
  );
  todayStart.setTime(todayStart.getTime() - kstOffset);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId,
    timeMin: todayStart.toISOString(),
    timeMax: todayEnd.toISOString(),
    singleEvents: true,
    q: WEEKLY_SYNC_EVENT_NAME,
  });

  const events = response.data.items ?? [];
  return events.some(
    (e) =>
      e.summary?.toLowerCase().includes(WEEKLY_SYNC_EVENT_NAME.toLowerCase())
  );
}
