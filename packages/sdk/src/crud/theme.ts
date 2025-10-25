import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";
import type { Theme } from "../theme.ts";

export interface GetProjectThemeInput {
  projectId?: string;
}

export interface UpdateProjectThemeInput {
  projectId?: string;
  theme: Theme;
}

export interface GetOrgThemeInput {
  locator: ProjectLocator;
  orgId: number;
}

export interface UpdateOrgThemeInput {
  locator: ProjectLocator;
  orgId: number;
  theme: Theme;
}

// Project theme tools disabled until fully implemented
/*
export const getProjectTheme = (
  input: GetProjectThemeInput,
  init?: RequestInit,
): Promise<Theme | null> =>
  MCPClient.THEME_GET_PROJECT(input, init) as Promise<Theme | null>;

export const updateProjectTheme = (
  input: UpdateProjectThemeInput,
  init?: RequestInit,
): Promise<Theme> =>
  MCPClient.THEME_UPDATE_PROJECT(input, init) as Promise<Theme>;
*/

export const getOrgThemeDirectly = async (
  input: GetOrgThemeInput,
  init?: RequestInit,
): Promise<Theme | null> => {
  const result = await MCPClient.forLocator(input.locator).THEME_GET_ORG(
    { orgId: input.orgId },
    init,
  );
  return (result as { theme: Theme | null }).theme;
};

export const updateOrgTheme = async (
  input: UpdateOrgThemeInput,
  init?: RequestInit,
): Promise<Theme> => {
  const result = await MCPClient.forLocator(input.locator).THEME_UPDATE_ORG(
    { orgId: input.orgId, theme: input.theme },
    init,
  );
  return (result as { theme: Theme }).theme;
};
