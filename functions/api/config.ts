import { FdCfFunc, getPublicSystemConfig, jsonResponse } from "../commons";

export const onRequestGet: FdCfFunc = async function (context) {
  const publicSystemConfig = getPublicSystemConfig(context.env);
  return jsonResponse(publicSystemConfig);
};
