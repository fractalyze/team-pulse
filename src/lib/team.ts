// Copyright 2026 Fractalyze Inc. All rights reserved.

import { Octokit } from "@octokit/rest";
import { ORG } from "./config";
import type { TeamMember } from "./types";

let cachedTeam: TeamMember[] | null = null;

/** Auto-discover team members from GitHub org. */
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

  // 2. Fetch profiles in parallel (for display name)
  const profiles = await Promise.all(
    members.map((m) =>
      octokit.users.getByUsername({ username: m.login }).then((r) => r.data)
    )
  );

  // 3. Assemble team
  const team: TeamMember[] = profiles.map((profile) => ({
    name: profile.name || profile.login,
    github: profile.login,
  }));

  console.log(
    `Auto-discovered ${team.length} team members:`,
    team.map((m) => `${m.name} (${m.github})`).join(", ")
  );

  cachedTeam = team;
  return team;
}

/** Clear cached team (useful for testing). */
export function clearTeamCache(): void {
  cachedTeam = null;
}
