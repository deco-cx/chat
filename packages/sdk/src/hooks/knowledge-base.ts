import { useMutation } from "@tanstack/react-query";
import { useSDK } from "./index.ts";
import { addFileToKnowledgeBase } from "../crud/knowledge-base.ts";

export const useAddFileToKnowledgeBase = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: ({ fileUrl, metadata }: {
      fileUrl: string;
      metadata?: Record<string, string>;
    }) => addFileToKnowledgeBase({ workspace, fileUrl, metadata }),
  });
};
