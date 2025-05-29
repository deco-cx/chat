import { MCPClient } from "../fetcher.ts";

export const getAssetUrl = async ({ key }: {
  key: string;
}) => {
  const { url } = await MCPClient
    .ASSET_GET_URL({ key });
  return url;
};

export const uploadAsset = async ({
  content,
  contentType,
}: {
  content: Uint8Array<ArrayBuffer>;
  contentType: string;
}) => {
  const { url, key } = await MCPClient
    .ASSET_UPLOAD({ content, contentType });

  return { url, key };
};

export const deleteAsset = async ({ key }: {
  key: string;
}) => {
  await MCPClient
    .ASSET_DELETE({ key });

  return { success: true };
};
