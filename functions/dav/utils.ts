import { KEY_PREFIX_PRIVATE, MIME_DIR, Permission, trimPrefixSuffix } from "../../lib/commons";
import { type FdCfFuncContext } from "../commons";

export interface RequestHandlerParams {
  bucket: R2Bucket;
  path: string;
  request: Request;
  /**
   * Current request target file permission
   */
  permission?: Permission;
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

function testPathHasPrefix(path: string, prefixesCsv: string): boolean {
  const prefixes = prefixesCsv.split(/\s*,\s*/).map((prefix) => trimPrefixSuffix(prefix, "/"));
  if (prefixes.some((prefix) => path === prefix || path.startsWith(prefix + "/"))) {
    return true;
  }
  return false;
}

export function checkPermission(context: FdCfFuncContext): Permission {
  const { env, params } = context;
  const pathSegments = (params.path || []) as String[];
  const path = decodeURIComponent(pathSegments.join("/"));
  if (env.PUBLIC_DIR_PREFIX && testPathHasPrefix(path, env.PUBLIC_DIR_PREFIX)) {
    return Permission.OpenDir;
  }
  if (env.PUBLIC_PREFIX && testPathHasPrefix(path, env.PUBLIC_PREFIX)) {
    return Permission.OpenFile;
  }
  return Permission.RequireAuth;
}

export function parseBucketPath(context: FdCfFuncContext): [R2Bucket, string] {
  const { request, env, params } = context;
  const url = new URL(request.url);

  const pathSegments = (params.path || []) as String[];
  const path = decodeURIComponent(pathSegments.join("/"));
  const driveid = url.hostname.replace(/\..*/, "");

  return [(env[driveid] as R2Bucket) || env.BUCKET, path];
}
