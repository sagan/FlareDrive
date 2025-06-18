import { str2int } from "../../lib/commons";
import { checkAuthFailure, FdCfFunc, jsonResponse, responseInternalServerError } from "../commons";
import { queryDbFiles } from "../db";

export const onRequestGet: FdCfFunc = async function (context) {
  const { request, env } = context;
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
  const depth = str2int(searchParams.get("depth"), -1);
  const full = !!str2int(searchParams.get("full"));

  try {
    const files = await queryDbFiles(db, query, { prefix, full, limit, offset, depth });
    return jsonResponse(files);
  } catch (error) {
    return responseInternalServerError();
  }
};
