import { checkAuthFailure, FdCfFunc, jsonResponse, responseInternalServerError } from "../commons";
import { createSdk } from "../../graphql/index";

export const onRequestGet: FdCfFunc = async function (context) {
  const { request, env } = context;
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN) {
    return responseInternalServerError("CF_ACCOUNT_ID, CF_ANALYTICS_TOKEN env must be set to access statistics");
  }

  const sdk = createSdk(env.CF_ANALYTICS_TOKEN);
  const today = new Date();
  const startTimeOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const endTimeOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  const dayOneWeekBefore = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 7));

  const data = await sdk.GetStatistics({
    accountTag: env.CF_ACCOUNT_ID,
    startTimeOfMonth: startTimeOfMonth.toISOString().slice(0, 19) + "Z",
    endTimeOfMonth: endTimeOfMonth.toISOString().slice(0, 19) + "Z",
    currentDate: today.toISOString().slice(0, 10),
    startDate: dayOneWeekBefore.toISOString().slice(0, 10),
  });

  return jsonResponse(data);
};
