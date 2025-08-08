import { FdCfFunc, getGlobalConfig } from "./commons";
import { parseBucketPath } from "./dav/utils";
import { handleGetShare } from "./s/[[path]]";

// The "catch-all" routing, process mappings: map path prefix to a published share.
export const onRequestGet: FdCfFunc = async function (context) {
  const { env, request } = context;
  const key = parseBucketPath(context);
  console.log("catch-all worker:", key, request.url);

  const globalConfig = await getGlobalConfig(env);
  // console.log("mappings", globalConfig.mappings);
  const keyParts = key.split("/");
  for (let i = keyParts.length; i > 0; i--) {
    const prefix = keyParts.slice(0, i).join("/");
    if (globalConfig.mappings[prefix]) {
      let path = globalConfig.mappings[prefix];
      if (i < keyParts.length) {
        path += "/" + keyParts.slice(i).join("/");
      }
      console.log("match prefix", prefix, globalConfig.mappings[prefix], path);
      return handleGetShare({ request, env, path });
    }
  }

  // Passes the incoming request through to the assets binding.
  // No asset matched this request, so this will evaluate `not_found_handling` behavior.
  return env.ASSETS.fetch(request);
};
