import { HEADER_AUTHORIZATION, THUMBNAIL_SIZE, WEBDAV_ENDPOINT, str2int } from "../../lib/commons";
import {
  FdCfFunc,
  checkAuthFailure,
  generateFileThumbnail,
  jsonResponse,
  responseInternalServerError,
} from "../commons";

interface PostBody {
  keys: string[];
}

/**
 * POST: Server-side thumbnails generation using Cloudflare images Transform:
 * https://developers.cloudflare.com/images/transform-images/transform-via-workers/ .
 * @param context
 */
export const onRequestPost: FdCfFunc = async function (context) {
  const bucket = context.env.BUCKET;
  const env = context.env;
  const request = context.request;
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const failResponse = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }

  if (!env.WORKER_URL || !env.WORKER_TOKEN) {
    return responseInternalServerError("WORKER_URL & WORKER_TOKEN must be configured to use this feature");
  }

  const force = !!str2int(searchParams.get("force"));
  const keys = searchParams.getAll("key");
  if (request.body) {
    const body = await request.json<PostBody>();
    keys.push(...body.keys);
  }

  const results: Record<string, number> = {};
  for (const key of keys) {
    const result = await generateFileThumbnail({
      auth: request.headers.get(HEADER_AUTHORIZATION),
      bucket,
      key,
      force,
      thumbSize: THUMBNAIL_SIZE,
      urlPrefix: env.BUCKET_URL || url.origin + WEBDAV_ENDPOINT,
      workerUrl: env.WORKER_URL,
      workerToken: env.WORKER_TOKEN,
    });
    results[key] = result;
  }

  return jsonResponse(results);
};
