import { GlobalConfig, GlobalConfigSchema } from "../../lib/commons";
import {
  checkAuthFailure,
  FdCfFunc,
  getGlobalConfig,
  getPublicConfig,
  jsonResponse,
  putGlobalConfig,
  responseBadRequest,
  responseInternalServerError,
} from "../commons";

export const onRequestGet: FdCfFunc = async function (context) {
  const { request, env } = context;
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  const globalConfig = await getGlobalConfig(context.env);
  return jsonResponse(failResponse ? getPublicConfig(globalConfig) : globalConfig);
};

export const onRequestPost: FdCfFunc = async function (context) {
  // Update globalConfig and return
  const { request, env } = context;
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  if (!env.KV) {
    return responseInternalServerError("KV must be set to update globalConfig");
  }
  let globalConfig: GlobalConfig;
  try {
    globalConfig = GlobalConfigSchema.parse(await request.json());
    delete globalConfig["buildConfig"];
    globalConfig.ok = true;
  } catch (e) {
    return responseBadRequest(`Invalid globalConfig: ${e}`);
  }
  globalConfig = await putGlobalConfig(env, globalConfig);
  return jsonResponse(globalConfig);
};
