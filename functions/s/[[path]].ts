// share file api
import { FdCfFunc, checkAuth, jsonResponse, notFound, pathSegmengs2Key } from "../commons";
import { ShareObject, trimPrefix } from "../../lib/commons";

const SHARE_KEY_PREFIX = "s_";

// POST: list shares
export const onRequestPost: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  if (!env.KV) {
    return notFound();
  }
  const failResponse = checkAuth(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  const pathPrefix = pathSegmengs2Key(params.path as string[]);

  const data = await env.KV.list({ prefix: SHARE_KEY_PREFIX + pathPrefix });

  const shares = data.keys.map(({ name }) => trimPrefix(name, SHARE_KEY_PREFIX));
  return jsonResponse(shares);
};

// PUT: add a new share
export const onRequestPut: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  if (!env.KV) {
    return notFound();
  }
  const failResponse = checkAuth(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  const path = pathSegmengs2Key(params.path as string[]);
  const shareObject: ShareObject = await request.json();
  await env.KV.put(SHARE_KEY_PREFIX + path, JSON.stringify(shareObject));

  return notFound();
};

// GET: request a shared file
export const onRequestGet: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  if (!env.KV) {
    return notFound();
  }

  const path = pathSegmengs2Key(params.path as string[]);

  const data = (await env.KV.get(SHARE_KEY_PREFIX + path, "json")) as ShareObject | null;
  if (!data || !data.state) {
    return notFound();
  }

  const obj = await env.BUCKET.get(path, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (!obj) {
    return notFound();
  }
  if (!("body" in obj)) {
    return new Response("Preconditions failed", { status: 412 });
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  return new Response(obj.body, { headers });
};
