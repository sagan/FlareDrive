import { z } from "zod";
import { KEY_STATISTICS } from "../lib/commons";
import { Env } from "../functions/commons";
import { type Sdk } from "./index";

export const StatisticsSchema = z.object({
  date: z.coerce.date(),
  workersRequestsToday: z.number(),
  r2OperationsAThisMonth: z.number(),
  r2OperationsBThisMonth: z.number(),
  r2TotalStorage: z.number(),
  d1RowsReadToday: z.number(),
  d1RowsWrittenToday: z.number(),
});

export type Statistics = z.infer<typeof StatisticsSchema>;

/**
 * Fetch statistics from Cloudflare Metrics GraphQL API.
 */
export async function fetchStatistics(sdk: Sdk, accountId: string, date: Date): Promise<Statistics> {
  const startTimeOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const endTimeOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  const dayOneWeekBefore = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 7));

  const stats = await sdk.GetStatistics({
    accountTag: accountId,
    startTimeOfMonth: startTimeOfMonth.toISOString().slice(0, 19) + "Z",
    endTimeOfMonth: endTimeOfMonth.toISOString().slice(0, 19) + "Z",
    currentDate: date.toISOString().slice(0, 10),
    startDate: dayOneWeekBefore.toISOString().slice(0, 10),
  });

  return {
    date,
    workersRequestsToday: stats.viewer?.accounts[0]?.workersInvocationsAdaptive[0]?.sum?.requests || 0,
    r2OperationsAThisMonth: stats.viewer?.accounts[0]?.classA[0]?.sum?.requests || 0,
    r2OperationsBThisMonth: stats.viewer?.accounts[0]?.classB[0]?.sum?.requests || 0,
    r2TotalStorage:
      (stats?.viewer?.accounts[0].r2StorageAdaptiveGroups[0].max?.metadataSize || 0) +
      (stats?.viewer?.accounts[0].r2StorageAdaptiveGroups[0].max?.payloadSize || 0),
    d1RowsReadToday: stats.viewer?.accounts[0]?.d1AnalyticsAdaptiveGroups[0]?.sum?.rowsRead || 0,
    d1RowsWrittenToday: stats.viewer?.accounts[0]?.d1AnalyticsAdaptiveGroups[0]?.sum?.rowsWritten || 0,
  };
}

/**
 * Update statistics to KV and do other post tasks.
 * @returns
 */
export async function updateStatistics(env: Env, stats: Statistics) {
  if (!env.KV) {
    return;
  }
  await env.KV.put(KEY_STATISTICS, JSON.stringify(stats));
}
