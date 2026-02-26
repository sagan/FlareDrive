import {
  HEADER_ALLOW,
  HEADER_DAV,
  METHOD_COPY,
  METHOD_DELETE,
  METHOD_GET,
  METHOD_HEAD,
  METHOD_MKCOL,
  METHOD_MOVE,
  METHOD_OPTIONS,
  METHOD_POST,
  METHOD_PROPFIND,
  METHOD_PROPPATCH,
  METHOD_PUT,
} from "../../lib/commons";
import { FdCfFunc, checkAuthFailure, getPathArray, responseMethodNotAllowed } from "../commons";
import { handleRequestCopy } from "./copy";
import { handleRequestDelete } from "./delete";
import { handleRequestGet } from "./get";
import { handleRequestHead } from "./head";
import { handleRequestMkcol } from "./mkcol";
import { handleRequestMove } from "./move";
import { handleRequestPropfind } from "./propfind";
import { handleRequestProppatch } from "./proppatch";
import { handleRequestPut } from "./put";
import { RequestHandlerParams, isOpenRequest } from "./utils";
import { handleRequestPost } from "./post";
import { getStorage } from "../storage";

async function handleRequestOptions() {
  return new Response(null, {
    headers: {
      [HEADER_ALLOW]: Object.keys(HANDLERS).join(", "),
      [HEADER_DAV]: "1",
    },
  });
}

const HANDLERS: Record<string, (context: RequestHandlerParams) => Promise<Response>> = {
  [METHOD_PROPFIND]: handleRequestPropfind,
  [METHOD_PROPPATCH]: handleRequestProppatch,
  [METHOD_MKCOL]: handleRequestMkcol,
  [METHOD_HEAD]: handleRequestHead,
  [METHOD_GET]: handleRequestGet,
  [METHOD_POST]: handleRequestPost,
  [METHOD_PUT]: handleRequestPut,
  [METHOD_COPY]: handleRequestCopy,
  [METHOD_MOVE]: handleRequestMove,
  [METHOD_DELETE]: handleRequestDelete,
};

export const onRequest: FdCfFunc = async function (context) {
  const env = context.env;
  const request: Request = context.request;
  const url = new URL(request.url);
  const bucket = getStorage(env);
  if (request.method === METHOD_OPTIONS) {
    return handleRequestOptions();
  }

  // eslint-disable-next-line prefer-const
  let [authFailResponse, scope] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (authFailResponse) {
    const [open, _scope] = await isOpenRequest(context);
    if (!open) {
      return authFailResponse;
    }
    scope = _scope;
  }

  let path = getPathArray(context).join("/");
  if (path != "" && !path.endsWith("/") && url.pathname.endsWith("/")) {
    path += "/";
  }
  const method: string = context.request.method;
  const handler = HANDLERS[method] ?? responseMethodNotAllowed;
  return handler({ context, path, request: context.request, scope, authed: !authFailResponse, bucket });
};
