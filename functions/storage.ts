import { Env } from "./commons";
import { S3Bucket } from "./s3";

/**
 * get storage instance from request env.
 * It supports native Cloudflare R2 binding (BUCKET) and S3_ENDPOINT defined s3 storage.
 */
export function getStorage(env: Env): R2Bucket {
  if (env.S3_ENDPOINT) {
    return new S3Bucket({
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || "",
      region: env.S3_REGION,
    });
  }
  if (!env.BUCKET) {
    throw new Error("no bucket binded");
  }
  return env.BUCKET;
}
