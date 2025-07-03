import { GlobalConfig, GlobalConfigSchema } from "../../lib/commons";
import {
  checkAuthFailure,
  FdCfFunc,
  getGlobalConfig,
  getPublicSystemConfig,
  jsonResponse,
  putGlobalConfig,
  responseBadRequest,
  responseInternalServerError,
} from "../commons";

export const onRequestGet: FdCfFunc = async function (context) {
  const globalConfig = await getGlobalConfig(context.env);
  const publicSystemConfig = getPublicSystemConfig(globalConfig);
  return jsonResponse(publicSystemConfig);
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
  } catch (e) {
    return responseBadRequest(`Invalid globalConfig: ${e}`);
  }
  await putGlobalConfig(env, globalConfig);
  const publicSystemConfig = getPublicSystemConfig(globalConfig);
  return jsonResponse(publicSystemConfig);
};
