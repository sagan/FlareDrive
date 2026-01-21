import {
  CONFIG_API,
  HEADER_AUTHORIZATION,
  HEADER_CONTENT_TYPE,
  MIME_JSON,
  METHOD_POST,
  GlobalConfig,
  GlobalConfigSchema,
} from "../../lib/commons";

/**
 * Update global config.
 * @returns updated global config
 */
export async function updateGlobalConfig(auth: string, config: GlobalConfig): Promise<GlobalConfig> {
  const res = await fetch(CONFIG_API, {
    method: METHOD_POST,
    headers: {
      [HEADER_CONTENT_TYPE]: MIME_JSON,
      [HEADER_AUTHORIZATION]: auth,
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}: ${await res.text()}`);
  }
  const globalConfig = GlobalConfigSchema.parse(await res.json());
  return globalConfig;
}
