import { KEY_PREFIX_THUMBNAIL, str2int } from "../../lib/commons";
import { FdCfFunc, checkAuthFailure, responsePreconditionsFailed } from "../commons";
import { fallbackIconResponse } from "./icons";

// Standalone get thumbnail api
// If always return a valid image. If auth fails or thumbnail does not exist, return a default mime icon.
export const onRequestGet: FdCfFunc = async function (context) {
  const bucket = context.env.BUCKET;
  const env = context.env;
  const request = context.request;
  const searchParams = new URL(request.url).searchParams;
  const digest = searchParams.get("digest") || "";
  const ext = searchParams.get("ext") || "";
  const color = searchParams.get("color") || "";
  const no404 = !!str2int(searchParams.get("no404"));

  if (checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD)) {
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
    return responsePreconditionsFailed();
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
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
