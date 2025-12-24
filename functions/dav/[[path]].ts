import { FdCfFunc, checkAuthFailure, getPathArray, responseMethodNotAllowed } from "../commons";
import { handleRequestCopy } from "./copy";
import { handleRequestDelete } from "./delete";
import { handleRequestGet } from "./get";
import { handleRequestHead } from "./head";
import { handleRequestMkcol } from "./mkcol";
import { handleRequestMove } from "./move";
import { handleRequestPropfind } from "./propfind";
import { handleRequestPut } from "./put";
import { RequestHandlerParams, isOpenRequest } from "./utils";
import { handleRequestPost } from "./post";

async function handleRequestOptions() {
  return new Response(null, {
    headers: {
      Allow: Object.keys(HANDLERS).join(", "),
      DAV: "1",
    },
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

  // eslint-disable-next-line prefer-const
  let [authFailResponse, scope] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (authFailResponse) {
    const [open, _scope] = await isOpenRequest(context);
    if (!open) {
      return authFailResponse;
    }
    scope = _scope;
  }

  const path = getPathArray(context).join("/");
  const method: string = (context.request as Request).method;
  const handler = HANDLERS[method] ?? responseMethodNotAllowed;
  return handler({ context, path, request: context.request, scope, authed: !authFailResponse, bucket: env.BUCKET });
};
