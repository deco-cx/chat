import { useMutation } from "@tanstack/react-query";
import { createAPIKey } from "../crud/keys.ts";
import { useSDK } from "./store.tsx";

export const useCreateAPIKey = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: (params: {
      claims?: {
        appName: string;
        integrationId: string;
        state: unknown;
      };
      name: string;
      policies: Array<{ effect: "allow" | "deny"; resource: string }>;
    }) => createAPIKey(workspace, params),
  });
};
