import {
  CONFIG_API,
  HEADER_AUTHORIZATION,
  HEADER_CONTENT_TYPE,
  MIME_JSON,
  GlobalConfig,
  PublicSystemConfig,
  PublicSystemConfigSchema,
} from "../../lib/commons";

/**
 * Update global config.
 * @returns updated (client-visible) public system config
 */
export async function updateGlobalConfig(auth: string, config: GlobalConfig): Promise<PublicSystemConfig> {
  const res = await fetch(CONFIG_API, {
    method: "POST",
    headers: {
      [HEADER_CONTENT_TYPE]: MIME_JSON,
      [HEADER_AUTHORIZATION]: auth,
    },
    body: JSON.stringify(config),
  });
  const systemConfig = PublicSystemConfigSchema.parse(await res.json());
  return systemConfig;
}
