import { MCPClient } from "../fetcher.ts";

export interface Team {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}

export const listTeams = (
  init?: RequestInit,
): Promise<Team[]> => MCPClient.TEAMS_LIST({}, init) as Promise<Team[]>;

export const getTeam = (
  slug: string,
  init?: RequestInit,
): Promise<Team> => MCPClient.TEAMS_GET({ slug }, init) as Promise<Team>;

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

export interface UpdateTeamInput {
  id: number;
  data: Partial<
    Pick<Team, "name" | "slug"> & { stripe_subscription_id?: string }
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
): Promise<{ ok: boolean }> =>
  MCPClient.TEAMS_DELETE({ teamId }, init) as Promise<{ ok: boolean }>;
