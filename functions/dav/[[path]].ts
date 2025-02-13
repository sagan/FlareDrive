import { FdCfFunc, checkAuthFailure, responseMethodNotAllowed, responseNotFound } from "../commons";
import { parseBucketPath } from "./utils";
import { handleRequestCopy } from "./copy";
import { handleRequestDelete } from "./delete";
import { handleRequestGet } from "./get";
import { handleRequestHead } from "./head";
import { handleRequestMkcol } from "./mkcol";
import { handleRequestMove } from "./move";
import { handleRequestPropfind } from "./propfind";
import { handleRequestPut } from "./put";
import { RequestHandlerParams, requireAuth } from "./utils";
import { handleRequestPost } from "./post";

async function handleRequestOptions() {
  return new Response(null, {
    headers: { Allow: Object.keys(HANDLERS).join(", ") },
  });
}

const HANDLERS: Record<string, (context: RequestHandlerParams) => Promise<Response>> = {
  PROPFIND: handleRequestPropfind,
  MKCOL: handleRequestMkcol,
  HEAD: handleRequestHead,
  GET: handleRequestGet,
  POST: handleRequestPost,
  PUT: handleRequestPut,
  COPY: handleRequestCopy,
  MOVE: handleRequestMove,
  DELETE: handleRequestDelete,
};

export const onRequest: FdCfFunc = async function (context) {
  const env = context.env;
  const request: Request = context.request;
  if (request.method === "OPTIONS") {
    return handleRequestOptions();
  }

  const [authFailResponse, scope] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (requireAuth(context) && authFailResponse) {
    return authFailResponse;
  }

  const [bucket, path] = parseBucketPath(context);
  if (!bucket) {
    return responseNotFound();
  }

  const method: string = (context.request as Request).method;
  const handler = HANDLERS[method] ?? responseMethodNotAllowed;
  return handler({ context, bucket, path, request: context.request, scope, authed: !authFailResponse });
};
