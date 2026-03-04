// Copyright 2026 Fractalyze Inc. All rights reserved.

import { google } from "googleapis";
import { WEEKLY_SYNC_EVENT_NAME } from "../config";

function getCalendarClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!clientId || !clientSecret || !refreshToken || !calendarId) {
    return null;
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });

  return { calendar: google.calendar({ version: "v3", auth: oauth2 }), calendarId };
}

/** Check if today has a Weekly Sync event on the configured calendar. */
export async function hasWeeklySyncToday(): Promise<boolean> {
  const client = getCalendarClient();
  if (!client) {
    console.warn(
      "Google Calendar credentials not configured, skipping calendar check"
    );
    return false;
  }

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

  const response = await client.calendar.events.list({
    calendarId: client.calendarId,
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
