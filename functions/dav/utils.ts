import {
  METHODS_READ_DIR,
  METHODS_READ_FILE,
  MIME_DIR,
  SYSFILES,
  SYSFILE_NOACCESS,
  basename,
  path2Key,
} from "../../lib/commons";
import { getGlobalConfig, type FdCfFuncContext } from "../commons";

export interface RequestHandlerParams {
  context: FdCfFuncContext;
  bucket: R2Bucket;
  path: string;
  request: Request;
  /**
   * current auth valid scope
   */
  scope: string | null | undefined;
  /**
   * whether current request authenticated
   */
  authed?: boolean;
}

export const ROOT_OBJECT = {
  key: "",
  uploaded: new Date(),
  httpMetadata: {
    contentType: MIME_DIR,
    contentDisposition: undefined,
    contentLanguage: undefined,
  },
  customMetadata: undefined,
  size: 0,
  etag: undefined,
};

/**
 * Test a R2 key has strict prefix.
 * "foo/bar" and "foo" has "foo" prefix, but "foobar" doesn't.
 * Note: empty key is not a valid "prefix" and will be silently ignored.
 * @param key
 * @param prefixes path prefixes. Each prefix must be non-empty and don't start or end with whitespace or "/".
 * @param includeSelf bool. If set to true, "foo" path will be treated with has "foo" prefix.
 * Otherwise only "foo/..." path will match with "foo" prefix.
 * @returns matched prefix, or empty string if none matched
 */
function testKeyHasPrefix(key: string, prefixes: string[], includeSelf?: boolean): string {
  for (const prefix of prefixes) {
    if ((includeSelf && key === prefix) || key.startsWith(prefix + "/")) {
      return prefix;
    }
  }
  return "";
}

/**
 * Check whether current request is a open (public) request (does not require auth)
 * @param context
 * @returns
 */
export async function isOpenRequest(context: FdCfFuncContext): Promise<[open: boolean, scope: string]> {
  const { env, params } = context;
  const key = path2Key(((params.path as string[]) || []).join("/"));
  const globalConfig = await getGlobalConfig(env);
  if (key && !SYSFILES.includes(basename(key))) {
    let matched = false;
    if (!matched) {
      const prefix = testKeyHasPrefix(key, globalConfig.publicPrefix, true);
      if (prefix) {
        matched = true;
        if (METHODS_READ_FILE.includes(context.request.method)) {
          const flagFile = await context.env.BUCKET.head(prefix + "/" + SYSFILE_NOACCESS);
          if (!flagFile) {
            return [true, prefix];
          }
        }
      }
    }
    if (!matched) {
      const prefix = testKeyHasPrefix(key, globalConfig.publicDirPrefix, true);
      if (prefix) {
        matched = true;
        if (METHODS_READ_DIR.includes(context.request.method)) {
          const flagFile = await context.env.BUCKET.head(prefix + "/" + SYSFILE_NOACCESS);
          if (!flagFile) {
            return [true, prefix];
          }
        }
      }
    }
    if (!matched) {
      const prefix = testKeyHasPrefix(
        key,
        globalConfig.publicRwdirPrefix,
        METHODS_READ_DIR.includes(context.request.method)
      );
      if (prefix) {
        matched = true;
        const flagFile = await context.env.BUCKET.head(prefix + "/" + SYSFILE_NOACCESS);
        if (!flagFile) {
          return [true, prefix];
        }
      }
    }
  }
  return [false, ""];
}

export function parseBucketPath(context: FdCfFuncContext): [R2Bucket, string] {
  const { env, params } = context;
  const pathSegments = (params.path || []) as String[];
  const path = decodeURIComponent(pathSegments.join("/"));
  return [env.BUCKET, path];
}
