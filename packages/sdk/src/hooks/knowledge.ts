import { useMutation, useQuery } from "@tanstack/react-query";
import { useSDK } from "./index.ts";
import {
  createKnowledge,
  knowledgeAddFile,
  knowledgeDeleteFile,
  knowledgeListFiles,
} from "../crud/knowledge.ts";
import type { Integration } from "../index.ts";
import { KEYS } from "./api.ts";

interface ForConnection {
  connection?: Integration["connection"];
}

export const useCreateKnowledge = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: ({ name }: {
      name: string;
    }) => createKnowledge({ workspace, name }),
  });
};

interface AddFileToKnowledgeParams extends ForConnection {
  fileUrl: string;
  path: string;
  metadata?: Record<string, string>;
}

export const useKnowledgeAddFile = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: (
      { fileUrl, metadata, path, connection }: AddFileToKnowledgeParams,
    ) => knowledgeAddFile({ workspace, fileUrl, metadata, path, connection }),
    // TODO: on settle add file from query client
  });
};

interface KnowledgeDeleteFileParams extends ForConnection {
  fileUrl: string;
}

export const useKnowledgeDeleteFile = () => {
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: ({ connection, fileUrl }: KnowledgeDeleteFileParams) =>
      knowledgeDeleteFile({ workspace, fileUrl, connection }),
    // TODO: on settle remove files from query client
  });
};

interface KnowledgeListFilesParams extends ForConnection {}

export const useKnowledgeListFiles = (
  params: KnowledgeListFilesParams,
) => {
  const { workspace } = useSDK();
  const { connection } = params;
  const connectionUrl = connection && "url" in connection ? connection.url : "";
  const hasConnection = "connection" in params;

  return useQuery({
    queryKey: KEYS.KNOWLEDGE_FILES(workspace, connectionUrl),
    queryFn: () =>
      "connection" in params
        ? knowledgeListFiles({ workspace, connection })
        : [],
    enabled: hasConnection ? !!connectionUrl : true,
  });
};
