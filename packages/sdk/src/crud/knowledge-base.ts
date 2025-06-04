import { MCPClient } from "../fetcher.ts";

export const addFileToKnowledgeBase = (
  { fileUrl, workspace, metadata }: {
    fileUrl: string;
    workspace: string;
    metadata?: Record<string, string>;
  },
) =>
  MCPClient.forWorkspace(workspace).KNOWLEDGE_BASE_ADD_FILE({
    fileUrl,
    metadata,
  });
