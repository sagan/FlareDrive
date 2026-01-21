import {
  THUMBNAIL_EXT_VARIABLE,
  HEADER_AUTHED,
  HEADER_AUTHORIZATION,
  HEADER_CACHE_CONTROL,
  CACHE_CONTROL_CACHE_LONGTIME,
  KEY_PREFIX_THUMBNAIL,
  PRIVATE_URL_TTL,
  THUMBNAIL_COLOR_VARIABLE,
  THUMBNAIL_CONTENT_TYPE,
  THUMBNAIL_NO404_VARIABLE,
  THUMBNAIL_DIGEST_VARIABLE,
  THUMBNAIL_NOFALLBACK,
  str2int,
} from "../../lib/commons";
import {
  FdCfFunc,
  checkAuthFailure,
  generateFileThumbnail,
  generateFileThumbnailWithWorker,
  getOnRequestHead,
  jsonResponse,
  responseInternalServerError,
  responseNotFound,
} from "../commons";
import { fallbackIconResponse } from "../icons";
import { getStorage } from "../storage";

interface PostBody {
  keys: string[];
}

/**
 * GET: get thumbnail directly from thumbnail digest
 * If always return a valid image. If auth fails or thumbnail does not exist, return a default mime icon.
 * @param context
 * @returns
 */
export const onRequestGet: FdCfFunc = async function (context) {
  const { request, env } = context;
  const bucket = getStorage(env);
  const searchParams = new URL(request.url).searchParams;
  const digest = searchParams.get(THUMBNAIL_DIGEST_VARIABLE) || "";
  const ext = searchParams.get(THUMBNAIL_EXT_VARIABLE) || "";
  const color = searchParams.get(THUMBNAIL_COLOR_VARIABLE) || "";
  const no404 = !!str2int(searchParams.get(THUMBNAIL_NO404_VARIABLE));
  const noFallback = !!str2int(searchParams.get(THUMBNAIL_NOFALLBACK));
  const contentType = searchParams.get(THUMBNAIL_CONTENT_TYPE);

  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (!digest || failResponse) {
    if (noFallback) {
      return responseNotFound();
    }
    return fallbackIconResponse(ext, contentType, color, no404);
  }

  const obj = await bucket.get(KEY_PREFIX_THUMBNAIL + digest, {
    onlyIf: request.headers,
    range: request.headers,
  });

  if (obj === null) {
    if (noFallback) {
      return responseNotFound();
    }
    return fallbackIconResponse(ext, contentType, color, no404);
  }

  if (!("body" in obj)) {
    return new Response("Preconditions failed", { status: 412, headers: { [HEADER_AUTHED]: "1" } });
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set(HEADER_AUTHED, "1");
  headers.set(HEADER_CACHE_CONTROL, CACHE_CONTROL_CACHE_LONGTIME);
  return new Response(obj.body, { headers });
};

export const onRequestHead = getOnRequestHead(onRequestGet);

/**
 * POST: Server-side thumbnails generation using Cloudflare images Transform:
 * https://developers.cloudflare.com/images/transform-images/transform-via-workers/ .
 * @param context
 */
export const onRequestPost: FdCfFunc = async function (context) {
  const { env, request } = context;
  const bucket = getStorage(env);
  const db = env.DB;
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }

  if (!env.IMAGES && (!env.WORKER_URL || !env.WORKER_TOKEN)) {
    return responseInternalServerError("IMAGES or WORKER_URL & WORKER_TOKEN must be configured to use this feature");
  }

  const force = !!str2int(searchParams.get("force"));
  const keys = searchParams.getAll("key");
  if (request.body) {
    const body = await request.json<PostBody>();
    keys.push(...body.keys);
  }

  const results: Record<string, number> = {};
  for (const key of keys) {
    let result: number;
    if (env.IMAGES) {
      result = await generateFileThumbnail({
        images: env.IMAGES,
        bucket,
        key,
        force,
        db,
      });
    } else if (env.WORKER_URL && env.WORKER_TOKEN) {
      result = await generateFileThumbnailWithWorker({
        auth: env.BUCKET_URL ? "" : request.headers.get(HEADER_AUTHORIZATION),
        bucket,
        key,
        force,
        expires: +new Date() + PRIVATE_URL_TTL,
        origin: env.BUCKET_URL || url.origin,
        originIsBucket: !!env.BUCKET_URL,
        workerUrl: env.WORKER_URL,
        workerToken: env.WORKER_TOKEN,
        db,
      });
    } else {
      result = -1;
    }
    results[key] = result;
  }

  return jsonResponse(results);
};
