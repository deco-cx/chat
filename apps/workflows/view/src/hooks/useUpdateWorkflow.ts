import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { Workflow } from "@/store/workflow";

export function useUpdateWorkflow() {
  return useMutation({
    mutationFn: async ({
      uri,
      workflow,
    }: {
      uri: string;
      workflow: Workflow;
    }) => {
      return await client.UPDATE_WORKFLOW({ uri, workflow });
    },
  });
}
