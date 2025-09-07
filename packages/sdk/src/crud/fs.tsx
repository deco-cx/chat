import { MCPClient } from "../fetcher.ts";

interface ListOptions {
  workspace: string;
  root: string;
}

export const listFiles = async ({ workspace, root }: ListOptions) => {
  const data = await MCPClient.forWorkspace(workspace).FS_LIST({
    prefix: root,
  });

  return data.items;
};

interface WriteOptions {
  path: string;
  workspace: string;
  content: Uint8Array;
  contentType: string;
  expiresIn?: number;
  metadata?: Record<string, string | string[]>;
}

export const writeFile = async ({
  path,
  workspace,
  content,
  contentType,
  expiresIn,
  metadata,
}: WriteOptions) => {
  const { url: uploadUrl } = await MCPClient.forWorkspace(workspace).FS_WRITE({
    path,
    contentType,
    metadata,
    ...(expiresIn ? { expiresIn } : {}),
  });

  const response = await fetch(uploadUrl!, {
    method: "PUT",
    // @ts-ignore todo: cloudflare types should not be affecting this
    body: content,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (!response.ok) {
    console.error(response);
    throw new Error("Failed to upload file");
  }

  return response;
};

interface ReadOptions {
  workspace: string;
  path: string;
  expiresIn?: number;
}

export const readFile = async ({ workspace, path, expiresIn }: ReadOptions) => {
  if (!path) {
    return null;
  }

  const { url } = await MCPClient.forWorkspace(workspace).FS_READ({
    path,
    ...(expiresIn ? { expiresIn } : {}),
  });

  return url;
};

interface DeleteOptions {
  workspace: string;
  path: string;
}

export const deleteFile = ({ workspace, path }: DeleteOptions) =>
  MCPClient.forWorkspace(workspace).FS_DELETE({ path });
