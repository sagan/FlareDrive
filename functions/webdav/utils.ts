export interface RequestHandlerParams {
  bucket: R2Bucket;
  path: string;
  request: Request;
}

export const WEBDAV_ENDPOINT = "/webdav/";

export const ROOT_OBJECT = {
  key: "",
  uploaded: new Date(),
  httpMetadata: {
    contentType: "application/x-directory",
    contentDisposition: undefined,
    contentLanguage: undefined,
  },
  customMetadata: undefined,
  size: 0,
  etag: undefined,
};

export function notFound() {
  return new Response("Not found", { status: 404 });
}

export function requireAuth(context: any): boolean {
  const { env, params, request } = context;
  if( env.WEBDAV_PUBLIC_READ && ["GET", "HEAD", "PROPFIND"].includes(request.method)) {
    return false
  }
  if( env.PUBLIC_PREFIX ) {
    const publicPrefixes = (env.PUBLIC_PREFIX as string || "").split(/\s*,\s*/).map(prefix => {
      if(prefix.startsWith("/")) {
        prefix = prefix.substring(1)
      }
      return prefix
    })
    const pathSegments = (params.path || []) as String[];
    const path = decodeURIComponent(pathSegments.join("/"));
    if( publicPrefixes.some(prefix => path === prefix || path.startsWith(prefix + "/")) ) {
      return false
    }
  }
  return true
}

export function parseBucketPath(context: any): [R2Bucket, string] {
  const { request, env, params } = context;
  const url = new URL(request.url);

  const pathSegments = (params.path || []) as String[];
  const path = decodeURIComponent(pathSegments.join("/"));
  const driveid = url.hostname.replace(/\..*/, "");

  return [env[driveid] || env["BUCKET"], path];
}

export async function* listAll(
  bucket: R2Bucket,
  prefix?: string,
  isRecursive: boolean = false
) {
  let cursor: string | undefined = undefined;
  do {
    var r2Objects = await bucket.list({
      prefix: prefix,
      delimiter: isRecursive ? undefined : "/",
      cursor: cursor,
      // @ts-ignore
      include: ["httpMetadata", "customMetadata"],
    });

    for await (const obj of r2Objects.objects)
      if (!obj.key.startsWith("_$flaredrive$/")) yield obj;

    if (r2Objects.truncated) cursor = r2Objects.cursor;
  } while (r2Objects.truncated);
}
