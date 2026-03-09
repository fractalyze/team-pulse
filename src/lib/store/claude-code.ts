// Copyright 2026 Fractalyze Inc. All rights reserved.

import { getRedis } from "./kv";
import type {
  ClaudeCodeDailySnapshot,
  ClaudeCodeTokens,
  ClaudeCodeUserAggregation,
  ClaudeCodeUserRecord,
  ClaudeCodeModelAggregation,
  ClaudeCodeUsageSummary,
  OtelConnectionStatus,
  OtelUserDayMetrics,
  ParsedOtelEntry,
} from "../types";

// ---------------------------------------------------------------------------
// OTel KV storage  (cc-otel:* namespace)
// ---------------------------------------------------------------------------

function otelDayKey(email: string, date: string): string {
  return `cc-otel:${email}:${date}`;
}

function emptyTokens(): ClaudeCodeTokens {
  return { input: 0, output: 0, cache_creation: 0, cache_read: 0 };
}

function emptyOtelDay(email: string, date: string): OtelUserDayMetrics {
  return {
    email,
    date,
    lastUpdated: new Date().toISOString(),
    costCents: 0,
    tokens: emptyTokens(),
    sessions: 0,
    locAdded: 0,
    locRemoved: 0,
    commits: 0,
    pullRequests: 0,
    toolAccepted: 0,
    toolRejected: 0,
    modelCosts: {},
    modelTokens: {},
  };
}

/** Accumulate delta OTel entries into KV. */
export async function accumulateOtelMetrics(
  entries: ParsedOtelEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  // Group by email+date
  const groups = new Map<string, ParsedOtelEntry[]>();
  for (const e of entries) {
    const key = `${e.email}::${e.date}`;
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    arr.push(e);
  }

  const redis = getRedis();

  for (const [, groupEntries] of groups) {
    const { email, date } = groupEntries[0];
    const kvKey = otelDayKey(email, date);

    // Load existing or init
    const existing = await redis.get<string>(kvKey);
    const day: OtelUserDayMetrics = existing
      ? typeof existing === "string"
        ? JSON.parse(existing)
        : existing
      : emptyOtelDay(email, date);

    // Apply each delta entry
    for (const entry of groupEntries) {
      const model = entry.attributes.model ?? "unknown";

      switch (entry.metric) {
        case "claude_code.token.usage": {
          const tokenType = entry.attributes.type; // input/output/cacheRead/cacheCreation
          const mappedType = mapTokenType(tokenType);
          if (mappedType) {
            day.tokens[mappedType] += entry.value;
            if (!day.modelTokens[model]) day.modelTokens[model] = emptyTokens();
            day.modelTokens[model][mappedType] += entry.value;
          }
          break;
        }
        case "claude_code.cost.usage":
          // OTel cost is in dollars, we store cents
          day.costCents += entry.value * 100;
          day.modelCosts[model] = (day.modelCosts[model] ?? 0) + entry.value * 100;
          break;
        case "claude_code.session.count":
          day.sessions += entry.value;
          break;
        case "claude_code.lines_of_code.count":
          if (entry.attributes.type === "removed") {
            day.locRemoved += entry.value;
          } else {
            day.locAdded += entry.value;
          }
          break;
        case "claude_code.commit.count":
          day.commits += entry.value;
          break;
        case "claude_code.pull_request.count":
          day.pullRequests += entry.value;
          break;
        case "claude_code.code_edit_tool.decision": {
          const decision = entry.attributes.decision;
          if (decision === "accept") day.toolAccepted += entry.value;
          else if (decision === "reject") day.toolRejected += entry.value;
          break;
        }
      }
    }

    day.lastUpdated = new Date().toISOString();
    await redis.set(kvKey, JSON.stringify(day));

    // Update indexes
    const dateScore = new Date(date).getTime();
    await redis.zadd("cc-otel:dates", { score: dateScore, member: date });
    await redis.sadd("cc-otel:emails", email);

    // Update connection status
    const statusKey = `cc-otel:status:${email}`;
    const statusData = await redis.get<string>(statusKey);
    const status: OtelConnectionStatus = statusData
      ? typeof statusData === "string"
        ? JSON.parse(statusData)
        : statusData
      : { email, lastSeen: "", totalDataPoints: 0 };
    status.lastSeen = new Date().toISOString();
    status.totalDataPoints += groupEntries.length;
    await redis.set(statusKey, JSON.stringify(status));
  }
}

function mapTokenType(
  otelType: string
): keyof ClaudeCodeTokens | null {
  switch (otelType) {
    case "input":
      return "input";
    case "output":
      return "output";
    case "cacheRead":
      return "cache_read";
    case "cacheCreation":
      return "cache_creation";
    default:
      return null;
  }
}

/** Get a single user's OTel day metrics. */
export async function getOtelUserDay(
  email: string,
  date: string
): Promise<OtelUserDayMetrics | null> {
  const redis = getRedis();
  const data = await redis.get<string>(otelDayKey(email, date));
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

/** Get all OTel user emails. */
export async function getOtelEmails(): Promise<string[]> {
  const redis = getRedis();
  const members = await redis.smembers("cc-otel:emails");
  return members as string[];
}

/** Get OTel dates (reverse chronological). */
export async function getOtelDates(limit: number = 60): Promise<string[]> {
  const redis = getRedis();
  const dates = await redis.zrange("cc-otel:dates", 0, limit - 1, {
    rev: true,
  });
  return dates as string[];
}

/** Delete all OTel data for a given email. */
export async function deleteOtelUser(email: string): Promise<number> {
  const redis = getRedis();
  const dates = await getOtelDates(365);
  let deleted = 0;

  for (const date of dates) {
    const key = otelDayKey(email, date);
    const removed = await redis.del(key);
    if (removed > 0) deleted++;
  }

  await redis.del(`cc-otel:status:${email}`);
  await redis.srem("cc-otel:emails", email);

  return deleted;
}

/** Get OTel connection statuses for the admin panel. */
export async function getOtelStatuses(): Promise<OtelConnectionStatus[]> {
  const emails = await getOtelEmails();
  if (emails.length === 0) return [];

  const redis = getRedis();
  const statuses: OtelConnectionStatus[] = [];
  for (const email of emails) {
    const data = await redis.get<string>(`cc-otel:status:${email}`);
    if (data) {
      statuses.push(typeof data === "string" ? JSON.parse(data) : data);
    }
  }
  return statuses.sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );
}

// ---------------------------------------------------------------------------
// OTel → ClaudeCodeUserRecord conversion
// ---------------------------------------------------------------------------

/**
 * Convert an OtelUserDayMetrics to a ClaudeCodeUserRecord.
 * This allows OTel data to feed into the existing aggregation pipeline.
 */
function otelToUserRecord(otel: OtelUserDayMetrics): ClaudeCodeUserRecord {
  const models = new Set([
    ...Object.keys(otel.modelCosts),
    ...Object.keys(otel.modelTokens),
  ]);

  const modelBreakdown = [...models].map((model) => ({
    model,
    tokens: otel.modelTokens[model] ?? emptyTokens(),
    estimated_cost: {
      amount: otel.modelCosts[model] ?? 0,
      currency: "USD",
    },
  }));

  const toolActions: Record<string, { accepted: number; rejected: number }> = {};
  if (otel.toolAccepted > 0 || otel.toolRejected > 0) {
    toolActions["code_edit"] = {
      accepted: otel.toolAccepted,
      rejected: otel.toolRejected,
    };
  }

  return {
    actor: { type: "user", email_address: otel.email },
    date: otel.date,
    terminal_type: "claude_code",
    customer_type: "otel",
    organization_id: "otel",
    core_metrics: {
      num_sessions: otel.sessions,
      lines_of_code: { added: otel.locAdded, removed: otel.locRemoved },
      commits_by_claude_code: otel.commits,
      pull_requests_by_claude_code: otel.pullRequests,
    },
    tool_actions: toolActions,
    model_breakdown: modelBreakdown,
  };
}

// ---------------------------------------------------------------------------
// OTel-only summary
// ---------------------------------------------------------------------------

/** Aggregate N days of Claude Code usage from OTel data. */
export async function getClaudeCodeSummary(
  periodDays: number
): Promise<ClaudeCodeUsageSummary | null> {
  const [otelDates, otelEmails] = await Promise.all([
    getOtelDates(periodDays * 2),
    getOtelEmails(),
  ]);

  if (otelDates.length === 0) return null;

  const targetDates = otelDates.slice(0, periodDays);
  const previousDates = otelDates.slice(periodDays, periodDays * 2);

  // Build daily snapshots from OTel data
  const days: ClaudeCodeDailySnapshot[] = [];

  for (const date of targetDates) {
    const records: ClaudeCodeUserRecord[] = [];
    for (const email of otelEmails) {
      const otelDay = await getOtelUserDay(email, date);
      if (otelDay) records.push(otelToUserRecord(otelDay));
    }

    if (records.length === 0) continue;

    // Compute totals
    let costCents = 0;
    let sessions = 0;
    let locAdded = 0;
    let locRemoved = 0;
    let commits = 0;
    let pullRequests = 0;
    for (const r of records) {
      sessions += r.core_metrics.num_sessions;
      locAdded += r.core_metrics.lines_of_code.added;
      locRemoved += r.core_metrics.lines_of_code.removed;
      commits += r.core_metrics.commits_by_claude_code;
      pullRequests += r.core_metrics.pull_requests_by_claude_code;
      for (const model of r.model_breakdown) {
        costCents += model.estimated_cost.amount;
      }
    }

    days.push({
      date,
      collectedAt: new Date().toISOString(),
      records,
      totals: { costCents, sessions, locAdded, locRemoved, commits, pullRequests },
    });
  }

  if (days.length === 0) return null;

  // Compute current period totals
  const totals = {
    costCents: 0,
    sessions: 0,
    locAdded: 0,
    locRemoved: 0,
    commits: 0,
    pullRequests: 0,
  };

  const userMap = new Map<string, ClaudeCodeUserAggregation>();
  const modelMap = new Map<string, ClaudeCodeModelAggregation>();
  const dailyCosts: { date: string; costCents: number }[] = [];

  for (const day of days) {
    totals.costCents += day.totals.costCents;
    totals.sessions += day.totals.sessions;
    totals.locAdded += day.totals.locAdded;
    totals.locRemoved += day.totals.locRemoved;
    totals.commits += day.totals.commits;
    totals.pullRequests += day.totals.pullRequests;

    dailyCosts.push({ date: day.date, costCents: day.totals.costCents });

    for (const record of day.records) {
      const email =
        record.actor.email_address ?? record.actor.api_key_name ?? "unknown";

      let user = userMap.get(email);
      if (!user) {
        user = {
          email,
          costCents: 0,
          sessions: 0,
          locAdded: 0,
          locRemoved: 0,
          commits: 0,
          pullRequests: 0,
          acceptanceRate: 0,
          cacheReadRatio: 0,
          modelBreakdown: [],
        };
        userMap.set(email, user);
      }

      user.sessions += record.core_metrics.num_sessions;
      user.locAdded += record.core_metrics.lines_of_code.added;
      user.locRemoved += record.core_metrics.lines_of_code.removed;
      user.commits += record.core_metrics.commits_by_claude_code;
      user.pullRequests += record.core_metrics.pull_requests_by_claude_code;

      for (const model of record.model_breakdown) {
        user.costCents += model.estimated_cost.amount;

        let m = modelMap.get(model.model);
        if (!m) {
          m = {
            model: model.model,
            costCents: 0,
            tokens: emptyTokens(),
          };
          modelMap.set(model.model, m);
        }
        m.costCents += model.estimated_cost.amount;
        m.tokens.input += model.tokens.input;
        m.tokens.output += model.tokens.output;
        m.tokens.cache_creation += model.tokens.cache_creation;
        m.tokens.cache_read += model.tokens.cache_read;
      }
    }
  }

  // Compute per-user acceptance rate and cache read ratio
  for (const day of days) {
    for (const record of day.records) {
      const email =
        record.actor.email_address ?? record.actor.api_key_name ?? "unknown";
      const user = userMap.get(email)!;

      let totalAccepted = 0;
      let totalRejected = 0;
      for (const action of Object.values(record.tool_actions)) {
        totalAccepted += action.accepted;
        totalRejected += action.rejected;
      }
      (user as unknown as Record<string, number>)._accepted =
        ((user as unknown as Record<string, number>)._accepted ?? 0) +
        totalAccepted;
      (user as unknown as Record<string, number>)._rejected =
        ((user as unknown as Record<string, number>)._rejected ?? 0) +
        totalRejected;

      let totalTokens = 0;
      let cacheRead = 0;
      for (const model of record.model_breakdown) {
        totalTokens +=
          model.tokens.input +
          model.tokens.output +
          model.tokens.cache_creation +
          model.tokens.cache_read;
        cacheRead += model.tokens.cache_read;
      }
      (user as unknown as Record<string, number>)._totalTokens =
        ((user as unknown as Record<string, number>)._totalTokens ?? 0) +
        totalTokens;
      (user as unknown as Record<string, number>)._cacheRead =
        ((user as unknown as Record<string, number>)._cacheRead ?? 0) +
        cacheRead;
    }
  }

  // Finalize user aggregations
  const byUser: ClaudeCodeUserAggregation[] = [];
  for (const user of userMap.values()) {
    const raw = user as unknown as Record<string, number>;
    const accepted = raw._accepted ?? 0;
    const rejected = raw._rejected ?? 0;
    const totalActions = accepted + rejected;
    user.acceptanceRate = totalActions > 0 ? accepted / totalActions : 0;

    const totalTokens = raw._totalTokens ?? 0;
    const cacheRead = raw._cacheRead ?? 0;
    user.cacheReadRatio = totalTokens > 0 ? cacheRead / totalTokens : 0;

    // Build per-user model breakdown
    const userModelMap = new Map<string, number>();
    for (const day of days) {
      for (const record of day.records) {
        const recordEmail =
          record.actor.email_address ?? record.actor.api_key_name ?? "unknown";
        if (recordEmail !== user.email) continue;
        for (const model of record.model_breakdown) {
          userModelMap.set(
            model.model,
            (userModelMap.get(model.model) ?? 0) + model.estimated_cost.amount
          );
        }
      }
    }
    user.modelBreakdown = [...userModelMap.entries()].map(
      ([model, costCents]) => ({ model, costCents })
    );

    delete raw._accepted;
    delete raw._rejected;
    delete raw._totalTokens;
    delete raw._cacheRead;

    byUser.push(user);
  }

  byUser.sort((a, b) => b.costCents - a.costCents);

  const byModel: ClaudeCodeModelAggregation[] = [...modelMap.values()].sort(
    (a, b) => b.costCents - a.costCents
  );

  dailyCosts.sort((a, b) => a.date.localeCompare(b.date));

  const tokenBreakdown = {
    input: 0,
    output: 0,
    cacheCreation: 0,
    cacheRead: 0,
  };
  for (const m of byModel) {
    tokenBreakdown.input += m.tokens.input;
    tokenBreakdown.output += m.tokens.output;
    tokenBreakdown.cacheCreation += m.tokens.cache_creation;
    tokenBreakdown.cacheRead += m.tokens.cache_read;
  }

  // Compute per-user daily costs
  const perUserDailyMap = new Map<string, Map<string, number>>();
  for (const day of days) {
    for (const record of day.records) {
      const email =
        record.actor.email_address ?? record.actor.api_key_name ?? "unknown";
      let userDaily = perUserDailyMap.get(email);
      if (!userDaily) {
        userDaily = new Map();
        perUserDailyMap.set(email, userDaily);
      }
      let dayCost = 0;
      for (const model of record.model_breakdown) {
        dayCost += model.estimated_cost.amount;
      }
      userDaily.set(day.date, (userDaily.get(day.date) ?? 0) + dayCost);
    }
  }

  const perUserDaily = [...perUserDailyMap.entries()].map(
    ([email, dailyMap]) => ({
      email,
      dailyCosts: [...dailyMap.entries()]
        .map(([date, costCents]) => ({ date, costCents }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    })
  );

  // Compute cost delta vs previous period
  let costDeltaCents: number | null = null;
  if (previousDates.length > 0) {
    let previousCost = 0;
    for (const date of previousDates) {
      for (const email of otelEmails) {
        const otelDay = await getOtelUserDay(email, date);
        if (otelDay) previousCost += otelDay.costCents;
      }
    }
    costDeltaCents = totals.costCents - previousCost;
  }

  return {
    days,
    periodDays,
    totals,
    costDeltaCents,
    byUser,
    byModel,
    dailyCosts,
    tokenBreakdown,
    perUserDaily,
  };
}
