import { useMutation, useQuery } from "@tanstack/react-query";
import { deleteAsset, getAssetUrl, uploadAsset } from "../crud/assets.ts";

export const useAssetUrl = (key: string) => {
  return useQuery({
    queryKey: ["asset", key],
    queryFn: () => getAssetUrl({ key }),
  });
};

export const useUploadAsset = () => {
  return useMutation({
    mutationFn: (
      asset: { content: Uint8Array<ArrayBuffer>; contentType: string },
    ) => uploadAsset(asset),
  });
};

export const useDeleteAsset = () => {
  return useMutation({
    mutationFn: (key: string) => deleteAsset({ key }),
  });
};
