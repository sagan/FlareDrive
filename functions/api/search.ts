import { str2int } from "../../lib/commons";
import { checkAuthFailure, FdCfFunc, jsonResponse, responseInternalServerError } from "../commons";
import { queryDbFiles } from "../db";

export const onRequestGet: FdCfFunc = async function (context) {
  const env = context.env;
  const request = context.request;
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  const db = env.DB;
  if (!db) {
    return responseInternalServerError("DB must be binded to use search");
  }
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const query = searchParams.get("query");
  if (!query) {
    return jsonResponse([]);
  }
  const prefix = searchParams.get("prefix") || "";
  const limit = str2int(searchParams.get("limit"), 10);
  const offset = str2int(searchParams.get("offset"));

  try {
    const files = await queryDbFiles(db, query, { prefix, limit, offset });
    return jsonResponse(files);
  } catch (error) {
    return responseInternalServerError();
  }
};
