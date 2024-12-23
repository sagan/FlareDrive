<<<<<<< HEAD
import { HEADER_AUTHED, KEY_PREFIX_THUMBNAIL, THUMBNAIL_SIZE, WEBDAV_ENDPOINT, str2int } from "../../lib/commons";
import {
  FdCfFunc,
  checkAuthFailure,
  generateFileThumbnail,
  jsonResponse,
  responseForbidden,
  responseNoContent,
} from "../commons";
=======
import { HEADER_AUTHED, KEY_PREFIX_THUMBNAIL, str2int } from "../../lib/commons";
import { FdCfFunc, checkAuthFailure } from "../commons";
>>>>>>> 0bc506bbba11926acd1c7bcfad8f8556d465964c
import { fallbackIconResponse } from "./icons";

/**
 * GET: get thumbnail of file.
 * If always return a valid image. If auth fails or thumbnail does not exist, return a default mime icon.
 * @param context
 * @returns
 */
export const onRequestGet: FdCfFunc = async function (context) {
  const bucket = context.env.BUCKET;
  const env = context.env;
  const request = context.request;
  const searchParams = new URL(request.url).searchParams;
  const digest = searchParams.get("digest") || "";
  const ext = searchParams.get("ext") || "";
  const color = searchParams.get("color") || "";
  const no404 = !!str2int(searchParams.get("no404"));

  if (await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD)) {
    return fallbackIconResponse(ext, color, no404);
  }
  if (!digest) {
    return fallbackIconResponse(ext, color, no404, true);
  }

  const obj = await bucket.get(KEY_PREFIX_THUMBNAIL + digest, {
    onlyIf: request.headers,
    range: request.headers,
  });

  if (obj === null) {
    return fallbackIconResponse(ext, color, no404, true);
  }

  if (!("body" in obj)) {
    return new Response("Preconditions failed", { status: 412, headers: { [HEADER_AUTHED]: "1" } });
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set(HEADER_AUTHED, "1");
  headers.set("Cache-Control", "max-age=31536000");
  return new Response(obj.body, { headers });
};

export const onRequestHead: FdCfFunc = async function (context) {
  const res = await onRequestGet(context);
  return new Response(null, {
    status: res.status,
    headers: res.headers,
  });
};

interface PostBody {
  keys: string[];
}

/**
 * POST: Generate thumbnails using Cloudflare images Transform:
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

  const force = !!str2int(searchParams.get("force"));
  const keys = searchParams.getAll("key");
  if (request.body) {
    const body: PostBody = await request.json();
    keys.push(...body.keys);
  }

  const results: Record<string, number> = {};
  for (const key of keys) {
    const result = await generateFileThumbnail({
      bucket,
      key,
      force,
      thumbSize: THUMBNAIL_SIZE,
      urlPrefix: env.BUCKET_URL || url.origin + WEBDAV_ENDPOINT,
    });
    results[key] = result;
  }

  return jsonResponse(results);
};
