import { S3Client } from "@aws-sdk/client-s3";

export interface S3Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

/**
 * Creates and returns a configured S3Client for Cloudflare R2
 * @param config S3 configuration object
 * @returns Configured S3Client instance
 */
export function getS3ServerClient(config: S3Config): S3Client {
  const { accountId, accessKeyId, secretAccessKey, region = "auto" } = config;

  return new S3Client({
    region,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}
