import { MCPClient } from "../fetcher.ts";
import type { Theme } from "../theme.ts";

export interface Team {
  id: number;
  name: string;
  slug: string;
  avatar_url?: string;
  theme?: Theme;
  created_at: string;
}

export const listTeams = (init?: RequestInit): Promise<Team[]> =>
  MCPClient.TEAMS_LIST({}, init) as Promise<Team[]>;

export const getTeam = (slug: string, init?: RequestInit): Promise<Team> =>
  MCPClient.TEAMS_GET({ slug }, init) as Promise<Team>;

export interface CreateTeamInput {
  name: string;
  slug?: string;
  stripe_subscription_id?: string;
  [key: string]: unknown;
}

export const createTeam = (
  input: CreateTeamInput,
  init?: RequestInit,
): Promise<Team> => MCPClient.TEAMS_CREATE(input, init) as Promise<Team>;

export const getWorkspaceTheme = (
  slug: string,
  init?: RequestInit,
): Promise<{ theme?: Theme } | null> =>
  MCPClient.TEAMS_GET_THEME({ slug }, init) as Promise<{
    theme?: Theme;
  } | null>;

export interface UpdateTeamInput {
  id: number;
  data: Partial<
    Pick<Team, "name" | "slug" | "theme"> & { stripe_subscription_id?: string }
  >;
  [key: string]: unknown;
}

export const updateTeam = (
  input: UpdateTeamInput,
  init?: RequestInit,
): Promise<Team> => MCPClient.TEAMS_UPDATE(input, init) as Promise<Team>;

export const deleteTeam = (
  teamId: number,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.TEAMS_DELETE({ teamId }, init) as Promise<{ success: boolean }>;
