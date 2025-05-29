import { ASSETS_URL } from "../constants.ts";
import { WELL_KNOWN_ORIGINS } from "../hosts.ts";
import { AppContext, getEnv } from "./context.ts";

export const ensureBucketExists = async (c: AppContext, bucketName: string) => {
  const { cf } = c;
  const env = getEnv(c);

  try {
    await cf.r2.buckets.get(bucketName, {
      account_id: env.CF_ACCOUNT_ID,
    });
  } catch (error) {
    if ((error as unknown as { status: number })?.status !== 404) {
      throw error;
    }

    // Create bucket
    await cf.r2.buckets.create({
      name: bucketName,
      account_id: env.CF_ACCOUNT_ID,
    });

    // Set cors
    await cf.r2.buckets.cors.update(bucketName, {
      account_id: env.CF_ACCOUNT_ID,
      rules: [{
        maxAgeSeconds: 3600,
        exposeHeaders: ["etag"],
        allowed: {
          methods: ["GET", "PUT"],
          origins: [...WELL_KNOWN_ORIGINS],
          headers: ["origin", "content-type"],
        },
      }],
    });
  }
};

export const getAssetUrl = (key: string) => {
  return `${ASSETS_URL}/public/${key.replace(/^\/+/, "")}`;
};
