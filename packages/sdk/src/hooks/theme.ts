import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  // getProjectTheme, // Disabled until project themes are fully implemented
  // updateProjectTheme, // Disabled until project themes are fully implemented
  getOrgThemeDirectly,
  updateOrgTheme,
  // type GetProjectThemeInput, // Disabled until project themes are fully implemented
  // type UpdateProjectThemeInput, // Disabled until project themes are fully implemented
  type GetOrgThemeInput,
  type UpdateOrgThemeInput,
} from "../crud/theme.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";
import { Locator } from "../locator.ts";

// Project theme hooks disabled until project themes are fully implemented
/*
export function useProjectTheme(projectId?: string) {
  const { locator } = useSDK();
  const effectiveProjectId = projectId || locator;

  return useQuery({
    queryKey: ["project-theme", effectiveProjectId],
    queryFn: () => getProjectTheme({ projectId: effectiveProjectId }),
    enabled: !!effectiveProjectId,
  });
}

export function useUpdateProjectTheme() {
  const client = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: UpdateProjectThemeInput) => updateProjectTheme(input),
    onSuccess: (_, variables) => {
      const projectId = variables.projectId || locator;
      client.invalidateQueries({ queryKey: ["project-theme", projectId] });
      
      // Also invalidate workspace theme since it depends on project theme
      const { org } = Locator.parse(locator);
      client.invalidateQueries({ queryKey: KEYS.TEAM_THEME(org) });
    },
  });
}
*/

export function useOrgTheme(orgId?: number) {
  const { locator } = useSDK();

  return useQuery({
    queryKey: ["org-theme", orgId],
    queryFn: () =>
      orgId && locator ? getOrgThemeDirectly({ locator, orgId }) : null,
    enabled: !!orgId && !!locator,
  });
}

export function useUpdateOrgTheme() {
  const client = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: Omit<UpdateOrgThemeInput, "locator">) => {
      if (!locator) throw new Error("No locator available");
      return updateOrgTheme({ ...input, locator });
    },
    onSuccess: (_, variables) => {
      client.invalidateQueries({ queryKey: ["org-theme", variables.orgId] });

      // Also invalidate workspace theme since it depends on org theme
      if (locator) {
        const { org } = Locator.parse(locator);
        client.invalidateQueries({ queryKey: KEYS.TEAM_THEME(org) });
      }
    },
  });
}
