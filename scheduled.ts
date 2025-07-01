import { Env } from "./functions/commons";
import { createSdk } from "./graphql";
import { fetchStatistics, updateStatistics } from "./graphql/statistics";

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID || !env.KV) {
    return;
  }
  console.log(`Cron event triggered: ${event.cron}`);
  const sdk = createSdk(env.CF_ANALYTICS_TOKEN);
  const now = new Date();
  const stats = await fetchStatistics(sdk, env.CF_ACCOUNT_ID, now);
  await updateStatistics(env, stats);
}
