import { MCPClient } from "../fetcher.ts";

export const addFileToKnowledge = (
  { fileUrl, workspace, metadata, path }: {
    workspace: string;
    fileUrl: string;
    path: string;
    metadata?: Record<string, string>;
  },
) =>
  MCPClient.forWorkspace(workspace).KNOWLEDGE_BASE_ADD_FILE({
    fileUrl,
    metadata,
    path,
  });

export const removeFromKnowledge = (
  { docId, workspace }: { docId: string; workspace: string },
) => MCPClient.forWorkspace(workspace).KNOWLEDGE_BASE_FORGET({ docId });
