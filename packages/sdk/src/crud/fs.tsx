import { MCPClient } from "../fetcher.ts";

interface ListOptions {
  workspace: string;
  root: string;
}

export const listFiles = async ({ workspace, root }: ListOptions) => {
  const data = await MCPClient
    .forWorkspace(workspace)
    .FS_LIST({ prefix: root });

  return data;
};

interface WriteOptions {
  path: string;
  workspace: string;
  content: Uint8Array;
  contentType: string;
  expiresIn?: number;
  metadata?: Record<string, string | string[]>;
  skipWrite?: boolean;
}

export const writeFile = async ({
  path,
  workspace,
  content,
  contentType,
  expiresIn,
  metadata,
  skipWrite,
}: WriteOptions) => {
  const { url: uploadUrl } = await MCPClient
    .forWorkspace(workspace)
    .FS_WRITE({
      path,
      contentType,
      metadata,
      ...(expiresIn ? { expiresIn } : {}),
    });

  if (skipWrite) {
    return { ok: true };
  }

  const response = await fetch(uploadUrl!, {
    method: "PUT",
    body: content,
    headers: {
      "Content-Type": contentType,
    },
  });

  return response;
};

interface ReadOptions {
  workspace: string;
  path: string;
  expiresIn?: number;
}

export const readFile = async ({
  workspace,
  path,
  expiresIn,
}: ReadOptions) => {
  if (!path) {
    return null;
  }

  const { url } = await MCPClient
    .forWorkspace(workspace)
    .FS_READ({ path, ...(expiresIn ? { expiresIn } : {}) });

  return url;
};

interface DeleteOptions {
  workspace: string;
  path: string;
}

export const deleteFile = ({ workspace, path }: DeleteOptions) =>
  MCPClient.forWorkspace(workspace).FS_DELETE({ path });
