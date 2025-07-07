import { KEY_STATISTICS, FORCR_VARIABLE, str2int } from "../../lib/commons";
import { fetchStatistics, Statistics, StatisticsSchema, updateStatistics } from "../../graphql/statistics";
import { checkAuthFailure, FdCfFunc, jsonResponse, responseInternalServerError } from "../commons";
import { createSdk } from "../../graphql";

export const onRequestGet: FdCfFunc = async function (context) {
  const { request, env } = context;
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  if (!env.KV || !env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN) {
    return responseInternalServerError("KV, CF_ACCOUNT_ID, CF_ANALYTICS_TOKEN env must be set to access statistics");
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const doUpdate = !!str2int(searchParams.get(FORCR_VARIABLE));

  let stats: Statistics;
  if (doUpdate) {
    const sdk = createSdk(env.CF_ANALYTICS_TOKEN);
    const now = new Date();
    stats = await fetchStatistics(sdk, env.CF_ACCOUNT_ID, now);
    await updateStatistics(env, stats);
  } else {
    const data = await env.KV.get(KEY_STATISTICS, "json");
    if (!data) {
      return responseInternalServerError("statistics data not ready yet");
    }
    stats = StatisticsSchema.parse(data);
  }

  return jsonResponse(stats);
};
