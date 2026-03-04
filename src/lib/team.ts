// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Octokit } from "@octokit/rest";
import { WebClient } from "@slack/web-api";
import { ORG } from "./config";
import type { TeamMember } from "./types";

let cachedTeam: TeamMember[] | null = null;

/** Auto-discover team members from GitHub org + Slack workspace. */
export async function getTeam(): Promise<TeamMember[]> {
  if (cachedTeam) return cachedTeam;

  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  const octokit = new Octokit({ auth: token });

  // 1. Fetch GitHub org members
  let members: { login: string }[];
  try {
    const { data } = await octokit.orgs.listMembers({
      org: ORG,
      per_page: 100,
    });
    members = data;
  } catch (error) {
    console.error(
      "Failed to list org members (token may need read:org scope):",
      error
    );
    return [];
  }

  if (members.length === 0) {
    console.warn(`No members found in org ${ORG}`);
    return [];
  }

  // 2. Fetch profiles in parallel (for display name + email)
  const profiles = await Promise.all(
    members.map((m) =>
      octokit.users.getByUsername({ username: m.login }).then((r) => r.data)
    )
  );

  // 3. Build Slack maps (email→userId + name→userId)
  const { emailMap, nameMap } = await buildSlackMaps();

  // 4. Assemble team (match by email first, then by display name)
  const team: TeamMember[] = profiles.map((profile) => {
    const displayName = profile.name || profile.login;
    const email = profile.email;
    let slackId = "TBD";
    if (email && emailMap.has(email.toLowerCase())) {
      slackId = emailMap.get(email.toLowerCase())!;
    } else if (nameMap.has(displayName.toLowerCase())) {
      slackId = nameMap.get(displayName.toLowerCase())!;
    }

    return {
      name: displayName,
      github: profile.login,
      slack: slackId,
    };
  });

  console.log(
    `Auto-discovered ${team.length} team members:`,
    team.map((m) => `${m.name} (${m.github}, slack=${m.slack !== "TBD" ? "linked" : "TBD"})`).join(", ")
  );

  cachedTeam = team;
  return team;
}

/** Build maps of email→userId and displayName→userId from Slack workspace. */
async function buildSlackMaps(): Promise<{
  emailMap: Map<string, string>;
  nameMap: Map<string, string>;
}> {
  const emailMap = new Map<string, string>();
  const nameMap = new Map<string, string>();
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { emailMap, nameMap };

  const client = new WebClient(token);
  try {
    let cursor: string | undefined;
    do {
      const res = await client.users.list({ limit: 200, cursor });
      for (const user of res.members ?? []) {
        if (user.deleted || user.is_bot || !user.id) continue;
        const email = user.profile?.email;
        if (email) {
          emailMap.set(email.toLowerCase(), user.id);
        }
        const realName = user.real_name ?? user.profile?.real_name;
        if (realName) {
          nameMap.set(realName.toLowerCase(), user.id);
        }
      }
      cursor = res.response_metadata?.next_cursor || undefined;
    } while (cursor);
  } catch (error) {
    console.warn("Failed to list Slack users for auto-discovery:", error);
  }

  return { emailMap, nameMap };
}

/** Clear cached team (useful for testing). */
export function clearTeamCache(): void {
  cachedTeam = null;
}
