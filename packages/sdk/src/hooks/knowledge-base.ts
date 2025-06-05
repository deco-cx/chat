import { useMutation } from "@tanstack/react-query";
import { useSDK } from "./index.ts";
import {
  addFileToKnowledge,
  removeFromKnowledge,
} from "../crud/knowledge-base.ts";

export const useAddFileToKnowledge = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: ({ fileUrl, metadata, path }: {
      fileUrl: string;
      path: string;
      metadata?: Record<string, string>;
    }) => addFileToKnowledge({ workspace, fileUrl, metadata, path }),
  });
};

export const useRemoveFromKnowledge = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: ({ docId }: {
      docId: string;
    }) => removeFromKnowledge({ workspace, docId }),
  });
};
