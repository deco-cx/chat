import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  addView,
  type AddViewInput,
  addResource,
  type AddResourceInput,
  createTeam,
  type CreateTeamInput,
  deleteTeam,
  getOrgTheme,
  getTeam,
  listAvailableViewsForConnection,
  listTeams,
  removeView,
  type RemoveViewInput,
  removeResource,
  type RemoveResourceInput,
  updateTeam,
  type UpdateTeamInput,
} from "../crud/teams.ts";
import {
  createProject,
  type CreateProjectInput,
  updateProject,
  type UpdateProjectInput,
  deleteProject,
  type DeleteProjectInput,
} from "../crud/projects.ts";
import { KEYS } from "./api.ts";
import { InternalServerError } from "../errors.ts";
import { DEFAULT_THEME } from "../theme.ts";
import { useSDK } from "./store.tsx";
import { MCPConnection } from "../models/index.ts";
import { listIntegrations } from "../crud/mcp.ts";
import { listProjects, listRecentProjects } from "../crud/projects.ts";
import type { Project } from "../models/project.ts";
import { Locator } from "../locator.ts";

/**
 * Hook to fetch teams - searching is done client-side for now.
 */
export const useOrganizations = (options: { searchQuery?: string } = {}) => {
  const search = options.searchQuery ?? "";

  const queryResult = useSuspenseQuery({
    // Once filtering is done server-side, update the queryKey to KEYS.TEAMS(options.query)
    queryKey: KEYS.TEAMS(),
    queryFn: ({ signal }) => listTeams({ signal }),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });

  if (search) {
    queryResult.data = queryResult.data.filter(
      (team) =>
        team.name.toLowerCase().includes(search.toLowerCase()) ||
        team.slug.toLowerCase().includes(search.toLowerCase()),
    );
  }

  return queryResult;
};

export const useProjects = (options: {
  searchQuery?: string;
  org: string;
}): Project[] => {
  const query = useSuspenseQuery({
    queryKey: KEYS.PROJECTS(options.org),
    queryFn: () => listProjects(options.org),
  });
  const search = options.searchQuery ?? "";

  const filtered = query.data.filter(
    (project) =>
      project.title.toLowerCase().includes(search.toLowerCase()) ||
      project.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return filtered;
};

export const useRecentProjects = (): Project[] => {
  const query = useSuspenseQuery<Project[]>({
    queryKey: KEYS.RECENT_PROJECTS(),
    queryFn: () => listRecentProjects(),
  });
  return query.data;
};

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: (result, variables) => {
      // Add the new project to the projects list cache
      client.setQueryData<Project[]>(KEYS.PROJECTS(variables.org), (old) => {
        if (!old) return [result];
        return [...old, result];
      });

      // Invalidate recent projects to refresh
      client.invalidateQueries({ queryKey: KEYS.RECENT_PROJECTS() });
    },
  });
}

export function useUpdateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(input),
    onSuccess: (result, variables) => {
      // Update the specific project in the projects list cache
      client.setQueryData<Project[]>(KEYS.PROJECTS(variables.org), (old) => {
        if (!old) return [result];
        return old.map((project) =>
          project.slug === variables.project
            ? {
                ...project,
                title: result.title,
              }
            : project,
        );
      });

      // Also update recent projects cache if it exists
      client.setQueryData<Project[]>(KEYS.RECENT_PROJECTS(), (old) => {
        if (!old) return old;
        return old.map((project) =>
          project.slug === variables.project &&
          project.org.slug === variables.org
            ? {
                ...project,
                title: result.title,
              }
            : project,
        );
      });
    },
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteProjectInput) => deleteProject(input),
    onSuccess: () => {
      // Invalidate all projects queries to refresh
      client.invalidateQueries({ queryKey: ["projects"] });
      // Invalidate recent projects to refresh
      client.invalidateQueries({ queryKey: KEYS.RECENT_PROJECTS() });
    },
  });
}

export const useTeam = (slug: string = "") => {
  return useSuspenseQuery({
    queryKey: KEYS.ORGANIZATION(slug),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    queryFn: ({ signal }) => {
      if (!slug.length) {
        return null;
      }
      return getTeam(slug, { signal });
    },
  });
};

export function useCreateTeam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeamInput) => createTeam(input),
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: KEYS.TEAMS() });
      client.setQueryData(["team", result.slug], result);
    },
  });
}

export function useUpdateTeam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTeamInput) => updateTeam(input),
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: KEYS.TEAMS() });
      client.setQueryData(["team", result.slug], result);
    },
  });
}

export function useDeleteTeam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => deleteTeam(teamId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: KEYS.TEAMS() });
      // Remove all team caches (by id or slug if needed)
    },
  });
}

export function useWorkspaceTheme() {
  const { locator } = useSDK();
  const { org, project } = Locator.parse(locator);

  return useQuery({
    queryKey: KEYS.TEAM_THEME(org),
    queryFn: async () => {
      // Import MCPClient dynamically to avoid circular dependencies
      const { MCPClient } = await import("../fetcher.ts");

      // Get org theme as fallback
      const orgData = await getOrgTheme(org);
      const orgTheme = orgData?.theme ?? {};

      // Project themes are disabled - only use org theme
      // Merge: DEFAULT_THEME <- orgTheme
      const mergedTheme = {
        ...DEFAULT_THEME,
        ...orgTheme,
        variables: {
          ...DEFAULT_THEME.variables,
          ...(orgTheme.variables || {}),
        },
      };

      return mergedTheme;
    },
  });
}

export function useAddView() {
  const client = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: AddViewInput) => addView(locator, input),
    onSuccess: () => {
      const { org } = Locator.parse(locator);
      // Invalidate team data to refresh views
      client.invalidateQueries({ queryKey: KEYS.ORGANIZATION(org) });
    },
  });
}

export function useRemoveView() {
  const client = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: RemoveViewInput) => removeView(locator, input),
    onSuccess: () => {
      const { org } = Locator.parse(locator);
      // Invalidate team data to refresh views
      client.invalidateQueries({ queryKey: KEYS.ORGANIZATION(org) });
    },
  });
}

export function useAddResource() {
  const client = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: AddResourceInput) => addResource(locator, input),
    onSuccess: () => {
      const { org } = Locator.parse(locator);
      // Invalidate team data to refresh resources
      client.invalidateQueries({ queryKey: KEYS.ORGANIZATION(org) });
    },
  });
}

export function useRemoveResource() {
  const client = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: RemoveResourceInput) => removeResource(locator, input),
    onSuccess: () => {
      const { org } = Locator.parse(locator);
      // Invalidate team data to refresh resources
      client.invalidateQueries({ queryKey: KEYS.ORGANIZATION(org) });
    },
  });
}

export function useConnectionViews(
  integration: { id: string; connection: MCPConnection } | null,
  suspense = true,
) {
  const { locator } = useSDK();
  const hook = suspense ? useSuspenseQuery : useQuery;

  const data = hook({
    queryKey: KEYS.TEAM_VIEWS(locator, integration?.id ?? "null"),
    queryFn: () => {
      if (!integration) {
        return { views: [] };
      }

      return listAvailableViewsForConnection(integration.connection);
    },
  });

  return data;
}

export function useIntegrationViews({ enabled = true }: { enabled?: boolean }) {
  const { locator } = useSDK();
  return useQuery({
    queryKey: KEYS.WORKSPACE_VIEWS(locator),
    enabled,
    queryFn: async ({ signal }) => {
      const integrations = await listIntegrations(
        locator,
        { binder: "View" },
        signal,
      );
      const promises = integrations.map(async (integration) => {
        const result = await listAvailableViewsForConnection(
          integration.connection,
        );
        return result.views.map((view) => ({
          ...view,
          integration: {
            id: integration.id,
            name: integration.name,
            icon: integration.icon,
            description: integration.description,
          },
        }));
      });
      const results = await Promise.all(promises);
      return results.flat();
    },
  });
}
