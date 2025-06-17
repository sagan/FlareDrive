import { trimPrefixSuffix } from "../../lib/commons";
import { ReindexerPayload } from "../../lib/reindexer";
import {
  checkAuthFailure,
  FdCfFunc,
  jsonResponse,
  requestJson,
  responseBadRequest,
  responseInternalServerError,
} from "../commons";

const STUB_NAME = "main";

export const onRequestGet: FdCfFunc = async function (context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  if (!env.REINDEXER_DO) {
    return responseInternalServerError("REINDEXER_DO not binded");
  }

  const doId = env.REINDEXER_DO.idFromName(STUB_NAME);
  const stub = env.REINDEXER_DO.get(doId);
  // Forward the status request to the DO
  const payload: ReindexerPayload = { command: "status" };
  const res = await stub.fetch(requestJson(url.origin, payload));
  const data = await res.json();
  console.log("reindex-api-status", res.status, data);
  return jsonResponse(data);
};

export const onRequestPost: FdCfFunc = async function (context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  if (!env.REINDEXER_DO) {
    return responseInternalServerError("REINDEXER_DO not binded");
  }

  try {
    const payload = await request.json<ReindexerPayload>();
    const doId = env.REINDEXER_DO.idFromName(STUB_NAME);
    const stub = env.REINDEXER_DO.get(doId);

    if (payload.path_prefix) {
      payload.path_prefix = trimPrefixSuffix(payload.path_prefix.trim(), "/");
      if (payload.path_prefix) {
        payload.path_prefix += "/";
      }
    }

    // Asynchronously call the DO to start the process.
    // The client doesn't need to wait for the entire re-indexing.
    context.waitUntil(stub.fetch(requestJson(url.origin, payload)));

    return jsonResponse({ message: "Re-indexing process initiated." });
  } catch (error) {
    console.error(`Error in reindex POST: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof SyntaxError) {
      return responseBadRequest("Invalid JSON payload.");
    }
    return responseInternalServerError("Failed to initiate re-indexing process.");
  }
};
