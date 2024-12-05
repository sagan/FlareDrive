// share file api
import {
  FdCfFunc,
  checkAuthFailure,
  jsonResponse,
  responseNotFound,
  joinPathSegments,
  responsePreconditionsFailed,
  responseNoContent,
} from "../commons";
import { type ShareObject, path2Key, path2Prefix, trimPrefix } from "../../lib/commons";

const SHARE_KEY_PREFIX = "s_";

// POST: list shares
export const onRequestPost: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  if (!env.KV) {
    return responseNotFound();
  }
  const failResponse = checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  const pathPrefix = path2Prefix(joinPathSegments(params.path as string[]));
  console.log("pathPrefix", pathPrefix);
  const data = await env.KV.list({ prefix: SHARE_KEY_PREFIX + pathPrefix });

  const shares = data.keys.map(({ name }) => trimPrefix(name, SHARE_KEY_PREFIX));
  return jsonResponse(shares);
};

// PUT: add a new share
export const onRequestPut: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  if (!env.KV) {
    return responseNotFound();
  }
  const failResponse = checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  const path = path2Key(joinPathSegments(params.path as string[]));
  const shareObject: ShareObject = await request.json();
  const options: KVNamespacePutOptions = {};
  if (shareObject.expiration) {
    options.expiration = shareObject.expiration;
  }
  await env.KV.put(SHARE_KEY_PREFIX + path, JSON.stringify(shareObject), options);

  return responseNotFound();
};

// DELETE: delete a new share
export const onRequestDelete: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  if (!env.KV) {
    return responseNotFound();
  }
  const failResponse = checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  const path = path2Key(joinPathSegments(params.path as string[]));
  await env.KV.delete(SHARE_KEY_PREFIX + path);
  return responseNoContent();
};

// GET: request a shared file meta or contents
export const onRequestGet: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  if (!env.KV) {
    return responseNotFound();
  }

  const url = new URL(request.url);
  const requestMeta = new URLSearchParams(url.search).get("meta");

  if (requestMeta) {
    const failResponse = checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
    if (failResponse) {
      return failResponse;
    }
  }

  const path = path2Key(joinPathSegments(params.path as string[]));
  const data = (await env.KV.get(SHARE_KEY_PREFIX + path, "json")) as ShareObject | null;
  if (requestMeta) {
    return jsonResponse(data);
  }
  if (!data || !data.state) {
    return responseNotFound();
  }

  const obj = await env.BUCKET.get(path, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (!obj) {
    return responseNotFound();
  }
  if (!("body" in obj)) {
    return responsePreconditionsFailed();
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  return new Response(obj.body, { headers });
};
