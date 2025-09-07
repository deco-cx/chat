import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  addView,
  type AddViewInput,
  createTeam,
  type CreateTeamInput,
  deleteTeam,
  getTeam,
  getWorkspaceTheme,
  listAvailableViewsForConnection,
  listTeams,
  removeView,
  type RemoveViewInput,
  updateTeam,
  type UpdateTeamInput,
} from "../crud/teams.ts";
import { KEYS } from "./api.ts";
import { InternalServerError } from "../errors.ts";
import { DEFAULT_THEME } from "../theme.ts";
import { useSDK } from "./store.tsx";
import { MCPConnection } from "../models/index.ts";
import { listIntegrations } from "../crud/mcp.ts";

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

export interface Project {
  id: number;
  name: string;
  slug: string;
  avatar_url?: string;
  org: {
    id: number;
    slug: string;
    avatar_url?: string;
  };
}

export const useProjects = (options: {
  searchQuery?: string;
  org: string;
}): Project[] => {
  const teams = useOrganizations();
  const search = options.searchQuery ?? "";
  const org = teams.data.find((team) => team.slug === options.org);

  if (!org) {
    throw new Error(`Organization ${options.org} not found`);
  }

  const projects = [
    {
      id: 1,
      name: `${org.name} Default Project`,
      slug: "default",
      org: {
        id: org.id,
        slug: org.slug,
        avatar_url: org.avatar_url,
      },
    },
  ];

  const filtered = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      project.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return filtered;
};

export const useTeam = (slug: string = "") => {
  return useSuspenseQuery({
    queryKey: KEYS.TEAM(slug),
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
  const slug = locator.split("/")[1] ?? "";
  return useQuery({
    queryKey: KEYS.TEAM_THEME(slug),
    queryFn: async () => {
      const data = await getWorkspaceTheme(slug);
      const theme = data?.theme ?? {};
      return {
        ...DEFAULT_THEME,
        ...theme,
      };
    },
  });
}

export function useAddView() {
  const client = useQueryClient();
  const { locator } = useSDK();
  const slug = locator.split("/")[1] ?? "";

  return useMutation({
    mutationFn: (input: AddViewInput) => addView(locator, input),
    onSuccess: () => {
      // Invalidate team data to refresh views
      client.invalidateQueries({ queryKey: KEYS.TEAM(slug) });
    },
  });
}

export function useRemoveView() {
  const client = useQueryClient();
  const { locator } = useSDK();
  const slug = locator.split("/")[1] ?? "";

  return useMutation({
    mutationFn: (input: RemoveViewInput) => removeView(locator, input),
    onSuccess: () => {
      // Invalidate team data to refresh views
      client.invalidateQueries({ queryKey: KEYS.TEAM(slug) });
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
