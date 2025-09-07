import { useQuery } from "@tanstack/react-query";
import { listThreads, type ThreadFilterOptions } from "../crud/thread.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export const useAuditEvents = (options: ThreadFilterOptions = {}) => {
  const { workspace } = useSDK();

  return useQuery({
    queryKey: KEYS.AUDITS(workspace, options),
    queryFn: ({ signal }) => listThreads(workspace, options, { signal }),
    staleTime: 0,
    gcTime: 0,
  });
};
