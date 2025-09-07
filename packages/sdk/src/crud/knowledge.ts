import { MCPClient } from "../fetcher.ts";
import type { Integration, ProjectLocator } from "../index.ts";
import type { WorkspaceTools } from "../mcp/index.ts";

interface FromWorkspace {
  workspace: ProjectLocator;
}

interface ForConnection {
  connection?: Integration["connection"];
}

const getClientFor = (
  workspace: ProjectLocator,
  connection?: Integration["connection"],
) => {
  return connection
    ? MCPClient.forConnection<WorkspaceTools>(connection)
    : MCPClient.forWorkspace(workspace);
};

interface KnowledgeAddFileParams extends FromWorkspace, ForConnection {
  fileUrl: string;
  path: string;
  filename?: string;
  metadata?: Record<string, string>;
}

export const knowledgeAddFile = ({
  fileUrl,
  workspace,
  metadata,
  path,
  filename,
  connection,
}: KnowledgeAddFileParams) =>
  getClientFor(workspace, connection).KNOWLEDGE_BASE_ADD_FILE({
    fileUrl,
    metadata,
    path,
    filename,
  });

interface KnowledgeListFilesParams extends FromWorkspace, ForConnection {}

export const knowledgeListFiles = ({
  workspace,
  connection,
}: KnowledgeListFilesParams) =>
  getClientFor(workspace, connection)
    .KNOWLEDGE_BASE_LIST_FILES({})
    .then((res) => res.items);

interface KnowledgeDeleteFileParams extends FromWorkspace, ForConnection {
  fileUrl: string;
}

export const knowledgeDeleteFile = ({
  workspace,
  connection,
  fileUrl,
}: KnowledgeDeleteFileParams) =>
  getClientFor(workspace, connection).KNOWLEDGE_BASE_DELETE_FILE({ fileUrl });

interface CreateKnowledgeParams extends FromWorkspace {
  name: string;
}

export const createKnowledge = ({ workspace, name }: CreateKnowledgeParams) =>
  MCPClient.forWorkspace(workspace).KNOWLEDGE_BASE_CREATE({
    name,
  });
