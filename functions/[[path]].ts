import { METHOD_GET } from "../lib/commons";
import { FdCfFunc, getGlobalConfig, getOnRequestHead, getPathArray, responseNotFound } from "./commons";
import { handleShare, ShareHandlerContext } from "./s/[[path]]";
import { getStorage } from "./storage";

// The "catch-all" routing, process mappings: map path prefix to a published share.
export const onRequest: FdCfFunc = async function (context) {
  const { env, request } = context;
  const key = getPathArray(context).join("/");
  console.log("catch-all worker:", key, request.url);

  if (env.KV) {
    const globalConfig = await getGlobalConfig(env);
    const keyParts = key.split("/");
    for (let i = keyParts.length; i > 0; i--) {
      const prefix = keyParts.slice(0, i).join("/");
      if (globalConfig.mappings[prefix]) {
        const shareKey = globalConfig.mappings[prefix];
        let relpath = keyParts.slice(i).join("/");
        if (relpath && request.url.endsWith("/")) {
          relpath += "/";
        }
        console.log("match prefix", prefix, shareKey, relpath);
        return handleShare({
          request,
          env: env as ShareHandlerContext["env"],
          bucket: getStorage(env),
          url: new URL(request.url),
          shareKey,
          relpath,
        });
      }
    }
  }

  if (request.method !== METHOD_GET) {
    return responseNotFound();
  }
  // Passes the incoming request through to the assets binding.
  // No asset matched this request, so this will evaluate `not_found_handling` behavior.
  return env.ASSETS.fetch(request);
};

export const onRequestHead = getOnRequestHead(onRequest);
