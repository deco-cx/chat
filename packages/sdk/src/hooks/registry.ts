import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { getRegistryApp } from "../crud/registry.ts";
import { useSDK } from "./store.tsx";

export const useGetRegistryApp = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: (params: { name: string }) => getRegistryApp(workspace, params),
  });
};

export class RegistryAppNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryAppNotFoundError";
  }
}

export type RegistryApp = Awaited<ReturnType<typeof getRegistryApp>>;

/**
 * Hook to get a registry app by client ID in the format @scope/app-name
 * @param params - Object containing clientId in format @scope/app-name
 */
export const useRegistryApp = (params: { clientId: string }) => {
  const { workspace } = useSDK();

  return useSuspenseQuery({
    queryKey: ["registry-app", workspace, params.clientId],
    queryFn: async () => {
      try {
        return await getRegistryApp(workspace, { name: params.clientId });
      } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message.includes("not found")) {
          throw new RegistryAppNotFoundError("App not found");
        }

        throw error;
      }
    },
  });
};
