import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import {
  KEY_PREFIX_PRIVATE,
  KEY_PREFIX_THUMBNAIL,
  TOKEN_VARIABLE,
  AUTH_VARIABLE,
  HEADER_AUTHORIZATION,
  NOSIGN_VARIABLES,
  HEADER_CONTENT_TYPE,
  HEADER_LAST_MODIFIED,
  HEADER_ETAG,
  METHODS_READ_DIR,
  FULL_CONTROL_VARIABLE,
  EXPIRES_VARIABLE,
  HEADER_CONTENT_LENGTH,
  HEADER_IF_UNMODIFIED_SINCE,
  HEADER_REFERRER_POLICY,
  SHARE_ENDPOINT,
  SCOPE_VARIABLE,
  WEBDAV_ENDPOINT,
  HEADER_CF_RESIZED,
  MIME_HTML,
  MIME_MARKDOWN,
  MIME_JSON,
  MIME_URL,
  THUMBNAIL_SIZE,
  KEY_GLOBAL_CONFIG,
  HEADER_CONTENT_SECURITY_POLICY,
  HEADER_CONTENT_TYPE_OPTIONS,
  CONTENT_SECURITY_POLICY_SANDBOX,
  CONTENT_TYPE_OPTIONS_NOSNIFF,
  REFERRER_POLICY_NOREFERRER,
  SCOPE_GLOBAL,
  KEY_PART_SEARCH,
  METHOD_POST,
  ROOT_OBJECT,
  sha256,
  hmacSha256Verify,
  key2Path,
  str2int,
  fileUrl,
  basicAuthorizationHeader,
  trimPrefix,
  constantTimeCompare,
  path2Key,
  trimPrefixSuffix,
  corsHeaders,
  isImage,
  fileDepth,
  PublicConfig,
  GlobalConfig,
  GlobalConfigSchema,
  isHtml,
  R2ObjectAlike,
  dirname,
  METHODS_WITH_BODY,
} from "../lib/commons";
import { parseUrlFile } from "../lib/mime";
import { dbFile2R2Object, queryDbFiles, upsertDbFile } from "./db";
// build_config.json is generated / updated at build time
import buildConfig from "../build_config.json";

export type Env = {
  /**
   * If set, use S3 compatible storage instead of Cloudflare R2.
   * S3 Bucket url. Either "https://endpoint/bucket" or "https://bucket.endpoint" style.
   * Bucket name info included in url.
   */
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  /**
   * Optional S3 region info. E.g. "us-west-001".
   * Some providers (like Backblaze B2) requires it exists and strictly matching endpoint.
   */
  S3_REGION?: string;

  /**
   * Flag. set it to any value (e.g. "1") to lift cloud download size limitation.
   */
  CLOUD_DOWNLOAD_UNLIMITED?: string;
  WEBDAV_USERNAME: string;
  WEBDAV_PASSWORD: string;
  /**
   * Cloudflare Account ID.
   * The uuid part of Cloudflare dashboard url, e.g.
   * https://dash.cloudflare.com/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6 => a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6 .
   * Used by statistics feature.
   */
  CF_ACCOUNT_ID?: string;
  /**
   * R2 bucket name. For CF Analytics API.
   */
  R2_BUCKET_NAME?: string;
  /**
   * KV id. For CF Analytics API.
   */
  KV_ID?: string;
  /**
   * D1 database id. For CF Analytics API.
   */
  DATABASE_ID?: string;
  /**
   * Cloudflare API token of Analytics. ("Read analytics and logs" template)
   */
  CF_ANALYTICS_TOKEN?: string;

  /**
   * Flag. set it to any value (e.g. "1") to enable dev mode.
   */
  DEV?: string;

  /**
   * Flag. set it to any value (e.g. "1") to enable full text search by default.
   */
  USE_FULL_SEARCH?: string;

  /**
   * Flag. set it to any value (e.g. "1") to enable hard share deletion mode.
   */
  HARD_SHARE_EXPIRATION?: string;
  /**
   * Comma-separated "public" path prefixes.
   * Path with any of these prefixes is allowed to read file anonymously
   * But dir browsing is NOT allowed.
   */
  PUBLIC_PREFIX?: string;
  /**
   * Comma-separated "public dir" path prefixes.
   * Path with any of these prefixes is allowed to read file / browser dir anonymously.
   */
  PUBLIC_DIR_PREFIX?: string;
  /**
   * Comma-separated "public writable dir" path prefixes.
   * Path with any of these prefixes is allowed to read file / browser dir and write / update dir anonymously.
   */
  PUBLIC_RWDIR_PREFIX?: string;
  /**
   * optional bucket public access url (without trailing "/"), e.g. "http://bucket-secret.example.com".
   * It is suggested to keep this url secret (choose a private & complex custom sub domain).
   * It's only used by functions/* and will not be leaked to front end.
   */
  BUCKET_URL?: string;
  /**
   * associated worker url. Must enable Cloudflare images transformation in worker domain zone.
   */
  WORKER_URL?: string;
  /**
   * associated worker token
   */
  WORKER_TOKEN?: string;
  BUCKET?: R2Bucket;
  KV?: KVNamespace;
  DB?: D1Database;
  IMAGES?: ImagesBinding;
  REINDEXER_DO?: DurableObjectNamespace;
  // [key: string]: any;
};

export type FdCfFuncContext = EventContext<
  Env,
  string, // params key type
  Record<string, unknown> // data type
>;

export type FdCfFuncContextRequest = FdCfFuncContext["request"];

export type FdCfFuncContextEnv = FdCfFuncContext["env"];

export type FdCfFunc = (context: FdCfFuncContext) => Response | Promise<Response>;

/**
 * Return 304 Not Modified response
 */
export function responseNotModified(): Response {
  return new Response(null, { status: 304 });
}

/**
 * Return 404 Not Found response
 */
export function responseNotFound(headers?: HeadersInit | undefined): Response {
  return new Response("Not found", { status: 404, headers });
}

/**
 * Return 412 Precondition Failed response
 */
export function responsePreconditionsFailed(): Response {
  return new Response("Preconditions failed", { status: 412 });
}

/**
 * Return 400 bad request response
 * @param msg optional http body message, default to "Bad Request"
 */
export function responseBadRequest(msg?: string): Response {
  return new Response(msg || "Bad request", { status: 400 });
}

/**
 * Return 409 Conflict response
 */
export function responseConflict(msg?: string): Response {
  return new Response(msg || "Conflict", { status: 409 });
}

/**
 * Return 204 No Content response
 */
export function responseNoContent(): Response {
  return new Response(null, { status: 204 });
}

/**
 * Return 201 Created response.
 * If body is a object, return a json response of it.
 */
export function responseCreated(body?: object | string): Response {
  if (typeof body === "object") {
    return jsonResponse(body, { status: 201 });
  }
  return new Response(body || "", { status: 201 });
}

/**
 * Return 403 Forbidden response
 */
export function responseForbidden(msg?: string): Response {
  return new Response(msg || "Forbidden", { status: 403 });
}

/**
 * Return 401 Unauthorized response
 */
export function responseUnauthorized(headers?: HeadersInit): Response {
  return new Response("Unauthorized", { status: 401, headers });
}

/**
 * Return 500 Internal Server Error response
 */
export function responseInternalServerError(msg?: string): Response {
  return new Response(msg || "Internal Server Error", { status: 500 });
}

/**
 * Return 302 Found redirection response
 * @param url
 */
export function responseRedirect(url: string, noreferer = false): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      ...(noreferer ? { [HEADER_REFERRER_POLICY]: REFERRER_POLICY_NOREFERRER } : {}),
    },
  });
}

/**
 * Return 405 Method Not Allowed response
 */
export function responseMethodNotAllowed(msg = "", headers?: HeadersInit): Response {
  return new Response(msg || "Method not allowed", { status: 405, headers });
}

/**
 * Return a json response of obj, status is by default 200.
 * @param obj
 * @param status
 * @returns
 */
export function jsonResponse<T = unknown>(
  obj: T,
  {
    status = 200,
    cors = false,
  }: {
    status?: number;
    cors?: boolean;
  } = {}
) {
  const headers = new Headers({ [HEADER_CONTENT_TYPE]: "application/json" });
  if (cors) {
    for (const [key, value] of Object.entries(corsHeaders)) {
      headers.set(key, value);
    }
  }
  return new Response(JSON.stringify(obj), {
    status,
    headers,
  });
}

export function htmlResponse(html: string) {
  return new Response(html, {
    headers: {
      [HEADER_CONTENT_TYPE]: "text/html",
    },
  });
}

/**
 * Some path prefixes and filenames are reserved by FlareDrive and can't be used by user.
 * If key is not a valid R2 file key, return a fail response.
 * Otherwise return null.
 */
export async function checkInvalidUserFileKey(key: string): Promise<Response | null> {
  const invalidKeys = [
    "index.html",
    "favicon.ico",
    "sitemap.xml",
    // When a user adds a website to the home screen of an Apple device (like an iPhone or iPad),
    // the device looks for an image file with this name at the root to use as the icon.
    "apple-touch-icon.png",
    // used by Microsoft browsers (Internet Explorer and Edge) to define the appearance of a website's tile
    // when it is pinned to the Windows Start screen.
    "browserconfig.xml",
    ".well-known",

    "assets",
    "dav",
    "s",
    "api",
  ];
  const parts = key.split("/");
  if (invalidKeys.includes(parts[0])) {
    return responseForbidden(`Prefix name "${parts[0]}" is reserved.`);
  }
  const invalidKeyPartValues = [KEY_PART_SEARCH];
  const invalidPart = parts.find((part) => invalidKeyPartValues.includes(part));
  if (invalidPart) {
    return responseForbidden(`Key part "${invalidPart}" is reserved.`);
  }
  return null;
}

/**
 * If authentication fails, return a failure response.
 * Otherwise return null, besides auth's valid scope, if any.
 * Specially, return "/" scope if is basic authorized.
 * @param request
 * @param user
 * @param pass
 * @returns
 */
export async function checkAuthFailure(
  request: Request,
  user: string,
  pass: string,
  realm = "WebDAV"
): Promise<[failResponse: Response | null, scope: string | undefined | null]> {
  if (!user && !pass) {
    return [responseForbidden(), undefined];
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const auth = searchParams.get(AUTH_VARIABLE) || request.headers.get(HEADER_AUTHORIZATION);
  const token = searchParams.get(TOKEN_VARIABLE);
  const expectedAuth = basicAuthorizationHeader(user, pass);
  let authed = false;
  let scope: string | undefined | null = undefined;

  if (auth) {
    authed = constantTimeCompare(auth, expectedAuth);
    if (authed) {
      scope = SCOPE_GLOBAL;
    }
  } else if (token) {
    authed = await (async () => {
      const expires = str2int(searchParams.get(EXPIRES_VARIABLE));
      const fullControl = str2int(searchParams.get(FULL_CONTROL_VARIABLE));
      if (
        (expires > 0 && expires <= +new Date()) ||
        (!fullControl && !(METHODS_READ_DIR as readonly string[]).includes(request.method))
      ) {
        return false;
      }
      for (const param of NOSIGN_VARIABLES) {
        searchParams.delete(param);
      }
      searchParams.sort();
      scope = searchParams.get(SCOPE_VARIABLE);
      let payload = "";
      if (!scope) {
        payload += url.pathname;
      } else {
        scope = trimPrefixSuffix(scope, "/");
        let key = url.pathname;
        key = trimPrefix(url.pathname, SHARE_ENDPOINT);
        key = trimPrefix(url.pathname, WEBDAV_ENDPOINT);
        key = path2Key(key);
        if (
          !((METHODS_READ_DIR as readonly string[]).includes(request.method) && key == scope) &&
          !key.startsWith(scope + "/")
        ) {
          return false;
        }
      }
      payload += searchParams.size ? "?" + searchParams.toString() : "";
      return await hmacSha256Verify(expectedAuth, token, payload);
    })();
  }

  if (!authed) {
    if (url.pathname.startsWith(SHARE_ENDPOINT) && (METHODS_READ_DIR as readonly string[]).includes(request.method)) {
      const basicAuthHeader: Record<string, string> = { "WWW-Authenticate": `Basic realm="${encodeURI(realm)}"` };
      return [responseUnauthorized(basicAuthHeader), scope];
    }
    return [responseUnauthorized(), scope];
  }
  return [null, scope];
}

export async function* listAll(bucket: R2Bucket, prefix?: string, isRecursive: boolean = false) {
  let cursor: string | undefined = undefined;
  let r2Objects: R2Objects;
  do {
    r2Objects = await bucket.list({
      prefix: prefix,
      delimiter: isRecursive ? undefined : "/",
      cursor: cursor,
      // @ts-expect-error include is not defined in type
      include: ["httpMetadata", "customMetadata"],
    });

    for await (const obj of r2Objects.objects) {
      if (!obj.key.startsWith(KEY_PREFIX_PRIVATE)) {
        yield obj;
      }
    }
    if (r2Objects.truncated) {
      cursor = r2Objects.cursor;
    }
  } while (r2Objects.truncated);
}

export async function findChildren({
  bucket,
  db,
  path,
  depth,
}: {
  bucket: R2Bucket;
  path: string;
  depth: string;
  db?: D1Database;
}) {
  if (!["1", "infinity"].includes(depth)) {
    return [];
  }
  if (db) {
    // use queryDbFiles to list files from db, instead of using bucket API.
    const prefix = path === "" || path.endsWith("/") ? path : `${path}/`;
    const files = await queryDbFiles(db, "", {
      prefix,
      depth: depth === "infinity" ? -1 : path ? fileDepth(path) + 1 : 0,
    });
    return files.map(dbFile2R2Object);
  }

  const objects: Array<R2Object> = [];
  const prefix = path === "" ? path : `${path}/`;
  for await (const object of listAll(bucket, prefix, depth === "infinity")) {
    objects.push(object);
  }

  return objects;
}

export async function generateFileThumbnail({
  images,
  bucket,
  key,
  db,
  force = false,
  thumbSize = THUMBNAIL_SIZE,
}: {
  images: ImagesBinding;
  bucket: R2Bucket;
  db?: D1Database;
  key: string;
  force?: boolean;
  thumbSize?: number;
}): Promise<number> {
  if (!key) {
    return 1;
  }
  const file = await bucket.get(key);
  if (!file || !isImage(file)) {
    return 2;
  }
  let thumbFile: R2Object | null = null;
  if (file.customMetadata?.thumbnail) {
    const thumbKey = KEY_PREFIX_THUMBNAIL + file.customMetadata?.thumbnail;
    thumbFile = await bucket.head(thumbKey);
    if (thumbFile && !force) {
      return 3;
    }
  }

  const transform: ImageTransform = { width: thumbSize, height: thumbSize, fit: "scale-down" };
  const format = "image/avif";
  const fileContents = await file.blob();
  const result = await images.input(fileContents.stream()).transform(transform).output({ format });
  const thumbResponse = result.response();
  // Does the response have headers?
  const thumbResponseHeaders = new Headers({
    [HEADER_CONTENT_TYPE]: format,
  });

  const thumbContents = await thumbResponse.blob();
  const thumbContentsDigest = await sha256(thumbContents);
  if (thumbFile && file.customMetadata?.thumbnail === thumbContentsDigest) {
    // new thumbnail file is same as old
    return 6;
  }
  // The only way to modify object metadata is to re-upload the object and set the metadata.
  await bucket.put(KEY_PREFIX_THUMBNAIL + thumbContentsDigest, thumbContents, { httpMetadata: thumbResponseHeaders });
  const updatedR2Obj = await bucket.put(key, fileContents.stream(), {
    httpMetadata: file.httpMetadata,
    customMetadata: Object.assign({}, file.customMetadata, { thumbnail: thumbContentsDigest }),
  });
  if (thumbFile) {
    // delete old thumbnail file
    await bucket.delete(thumbFile.key);
  }
  if (db) {
    try {
      await upsertDbFile(db, updatedR2Obj);
    } catch (e) {
      /* empty */
    }
  }
  return 0;
}

// CF Image Resizing feature is not supported in Pages env. Use standalone worker instead.
export async function generateFileThumbnailWithWorker({
  auth,
  bucket,
  key,
  origin,
  originIsBucket,
  expires,
  workerUrl,
  workerToken,
  db,
  force = false,
  thumbSize = THUMBNAIL_SIZE,
}: {
  auth: string | null;
  bucket: R2Bucket;
  key: string;
  origin: string;
  originIsBucket: boolean;
  expires: number;
  workerUrl: string;
  workerToken: string;
  db?: D1Database;
  force?: boolean;
  thumbSize?: number;
}): Promise<number> {
  if (!key) {
    return 1;
  }
  const file = await bucket.get(key);
  if (!file || !isImage(file)) {
    return 2;
  }
  let thumbFile: R2Object | null = null;
  if (file.customMetadata?.thumbnail) {
    const thumbKey = KEY_PREFIX_THUMBNAIL + file.customMetadata?.thumbnail;
    thumbFile = await bucket.head(thumbKey);
    if (thumbFile && !force) {
      return 3;
    }
  }
  const transform: ImageTransform = { width: thumbSize, height: thumbSize, fit: "scale-down" };

  // CF image resizing does NOT work in Pages (functions), Use standalone worker instead.
  // Note: must put auth info in target url, cann't put it in options.headers,
  // As it seems CF worker strip "Authorization" header from sub-requests that's inside request of worker.
  const targetFileUrl = originIsBucket ? origin + "/" + key2Path(key) : fileUrl({ key, auth, origin, expires });
  const thumbResponse = await fetch(workerUrl, {
    method: METHOD_POST,
    headers: {
      [HEADER_CONTENT_TYPE]: "application/json",
    },
    body: JSON.stringify({
      token: workerToken,
      url: targetFileUrl,
      options: {
        cf: { image: transform },
      },
    }),
  });
  if (!thumbResponse.ok) {
    throw new Error(`status=${thumbResponse.status}, targetFileUrl=${targetFileUrl}`);
  }
  // headers (such as Cf-Resized, Content-Length) only exists in "Transform via URL" response
  if (!thumbResponse.headers.get(HEADER_CF_RESIZED)) {
    return 4;
  }
  const thumbResponseSize = str2int(thumbResponse.headers.get(HEADER_CONTENT_LENGTH));
  if (!thumbResponseSize || thumbResponseSize >= file.size) {
    return 5;
  }
  const thumbResponseHeaders = thumbResponse.headers;

  const thumbContents = await thumbResponse.blob();
  const thumbContentsDigest = await sha256(thumbContents);
  if (thumbFile && file.customMetadata?.thumbnail === thumbContentsDigest) {
    // new thumbnail file is same as old
    return 6;
  }
  // The only way to modify object metadata is to re-upload the object and set the metadata.
  await bucket.put(KEY_PREFIX_THUMBNAIL + thumbContentsDigest, thumbContents, { httpMetadata: thumbResponseHeaders });
  const updatedR2Obj = await bucket.put(key, file.body, {
    httpMetadata: file.httpMetadata,
    customMetadata: Object.assign({}, file.customMetadata, { thumbnail: thumbContentsDigest }),
  });
  if (thumbFile) {
    // delete old thumbnail file
    await bucket.delete(thumbFile.key);
  }
  if (db) {
    try {
      await upsertDbFile(db, updatedR2Obj);
    } catch (e) {
      /* empty */
    }
  }
  return 0;
}

export function writeR2ObjectHeaders(obj: R2Object, headers: Headers) {
  obj.writeHttpMetadata(headers);
  headers.set(HEADER_LAST_MODIFIED, obj.uploaded.toUTCString());
  headers.set(HEADER_CONTENT_LENGTH, `${obj.size}`);
  if (obj.httpEtag) {
    headers.set(HEADER_ETAG, obj.httpEtag);
  }
}

/**
 * Get http response from R2Object
 * @param html bool If true, convert output to html if possible (when obj is certain some type like markdown)
 * @param fullHtml bool If true, output full html page, otherwise use sandboxed html.
 * @param raw bool If true, return raw object body without any processing.
 * Note: it will not redirect to url if obj is a url file.
 * @param download bool If true, send "Content-Disposition: attachment" header.
 * @param cors bool If true, send CORS Allow All headers
 */
export async function outputR2Object({
  obj,
  download,
  html,
  fullHtml,
  raw,
  cors,
}: {
  obj: R2Object | R2ObjectBody;
  download?: boolean;
  html?: boolean;
  fullHtml?: boolean;
  raw?: boolean;
  cors?: boolean;
}): Promise<Response> {
  if (!("body" in obj)) {
    return responseNotModified();
  }
  const headers = new Headers();
  writeR2ObjectHeaders(obj, headers);
  if (download) {
    headers.set("Content-Disposition", "attachment");
  }
  if (cors) {
    for (const [key, value] of Object.entries(corsHeaders)) {
      headers.set(key, value);
    }
  }
  if (!raw && obj.httpMetadata?.contentType == MIME_URL) {
    if (obj.customMetadata?.url) {
      return responseRedirect(obj.customMetadata.url, true);
    }
    const body = await obj.text();
    // return 302 redirect to the url
    return responseRedirect(parseUrlFile(body), true);
  }
  if (html && obj.httpMetadata?.contentType === MIME_MARKDOWN) {
    const body = await obj.text();
    const htmlOutput = await marked.parse(body);
    const sanitizedHtml = sanitizeHtml(htmlOutput);
    headers.set(HEADER_CONTENT_TYPE, MIME_HTML);
    headers.set(HEADER_CONTENT_TYPE_OPTIONS, CONTENT_TYPE_OPTIONS_NOSNIFF);
    headers.set(HEADER_REFERRER_POLICY, REFERRER_POLICY_NOREFERRER);
    if (!fullHtml) {
      headers.set(HEADER_CONTENT_SECURITY_POLICY, CONTENT_SECURITY_POLICY_SANDBOX);
    }
    headers.delete(HEADER_CONTENT_LENGTH);
    return new Response(sanitizedHtml, { headers });
  }
  headers.set(HEADER_CONTENT_TYPE_OPTIONS, CONTENT_TYPE_OPTIONS_NOSNIFF);
  headers.set(HEADER_REFERRER_POLICY, REFERRER_POLICY_NOREFERRER);
  if (isHtml(obj) && !fullHtml) {
    headers.set(HEADER_CONTENT_SECURITY_POLICY, CONTENT_SECURITY_POLICY_SANDBOX);
  }
  return new Response(obj.body, { headers });
}

/**
 * Check if request's If-Unmodified-Since header conflicts with existing R2 file
 * @param request
 * @param object
 * @returns
 */
export function checkConflict(request: Request, object?: R2Object | null | undefined): boolean {
  const ifNotModifiedHeader = request.headers.get(HEADER_IF_UNMODIFIED_SINCE);
  if (ifNotModifiedHeader) {
    const ts = +new Date(ifNotModifiedHeader);
    // treat epoch timestamp ('Thu, 01 Jan 1970 00:00:00 GMT') specially: always conflict is file exists.
    if (ts === 0 ? object : object && +object.uploaded > ts) {
      return true;
    }
  }
  return false;
}

/**
 * Return a "Content-Type: application/json" request to url.
 * @param method default to POST.
 */
export function requestJson(
  url: string | URL,
  payload: unknown,
  method: (typeof METHODS_WITH_BODY)[number] = METHOD_POST
): Request {
  if (url instanceof URL) {
    url = url.href;
  }
  return new Request(url, {
    method,
    body: JSON.stringify(payload),
    headers: {
      [HEADER_CONTENT_TYPE]: MIME_JSON,
    },
  });
}

let globalConfig: GlobalConfig | null | undefined;
let globalConfigTs = 0;
const CACHE_DURATION_MS = 60 * 1000;

/**
 * Update global config and return updated effective global config.
 * @returns
 */
export async function putGlobalConfig(env: Env, data: GlobalConfig): Promise<GlobalConfig> {
  if (!env.KV) {
    throw new Error("KV is not set");
  }
  await env.KV.put(KEY_GLOBAL_CONFIG, JSON.stringify(data));
  globalConfigTs = Date.now();
  globalConfig = { ...data, buildConfig };
  return globalConfig;
}

/**
 * Return current effective globalConfig from KV or environment variables.
 * This function does internal caching.
 */
export async function getGlobalConfig(env: Env, nocache = false): Promise<GlobalConfig> {
  const now = Date.now();
  if (!nocache && globalConfig !== undefined && now - globalConfigTs <= CACHE_DURATION_MS) {
    if (globalConfig === null) {
      throw new Error("invalid globalConfig");
    }
    return globalConfig;
  }

  if (env.KV) {
    try {
      const data = await env.KV.get(KEY_GLOBAL_CONFIG, "json");
      if (data) {
        globalConfig = GlobalConfigSchema.parse(data);
        globalConfig.buildConfig = buildConfig;
        globalConfigTs = now;
        return globalConfig;
      }
    } catch (e) {
      console.log(`Failed to parse KV globalConfig: ${e}`);
    }
  }

  const fallbackData: GlobalConfig = {
    buildConfig,
    ok: true,
    comment: "",
    dev: !!env.DEV,
    useFullSearch: !!env.USE_FULL_SEARCH,
    mappings: {},
    publicPrefix: env.PUBLIC_PREFIX
      ? env.PUBLIC_PREFIX.split(/\s*,\s*/)
          .map((prefix) => trimPrefixSuffix(prefix, "/"))
          .filter((prefix) => prefix)
      : [],
    publicDirPrefix: env.PUBLIC_DIR_PREFIX
      ? env.PUBLIC_DIR_PREFIX.split(/\s*,\s*/)
          .map((prefix) => trimPrefixSuffix(prefix, "/"))
          .filter((prefix) => prefix)
      : [],
    publicRwdirPrefix: env.PUBLIC_RWDIR_PREFIX
      ? env.PUBLIC_RWDIR_PREFIX.split(/\s*,\s*/)
          .map((prefix) => trimPrefixSuffix(prefix, "/"))
          .filter((prefix) => prefix)
      : [],
  };
  globalConfig = fallbackData;
  globalConfigTs = now;
  return globalConfig;
}

export function getPublicConfig(globalConfig: GlobalConfig): PublicConfig {
  const publicConfig: PublicConfig = {
    ok: globalConfig.ok,
    dev: globalConfig.dev,
    useFullSearch: globalConfig.useFullSearch,
    publicPrefix: globalConfig.publicPrefix,
    publicDirPrefix: globalConfig.publicDirPrefix,
    publicRwdirPrefix: globalConfig.publicRwdirPrefix,
  };
  return publicConfig;
}

/**
 * Get onRequestHead function.
 * It is used to return response headers without body.
 * This is useful for HEAD request, where body is not needed.
 * @param onRequestGet - The original onRequest function that handles GET requests.
 * @returns A new function that handles HEAD requests by calling the original function and returning headers only.
 */
export function getOnRequestHead(onRequestGet: FdCfFunc): FdCfFunc {
  return async function (context) {
    const res = await onRequestGet(context);
    return new Response(null, {
      status: res.status,
      headers: res.headers,
    });
  };
}

/**
 * get actual path array from Cloudflare worker [[id]].ts style file system routing path params.
 * which may be indeed undefined if user visit root url like "/s/" of "/s/[id].ts" routing.
 * Each element of returned array is url decoded and normalized.
 */
export function getPathArray(context: FdCfFuncContext): string[] {
  const pathParam = context.params.path;
  if (!pathParam) {
    return [];
  }
  if (typeof pathParam == "string") {
    const path = decodeURIComponent(trimPrefixSuffix(pathParam, "/"));
    if (path) {
      return [path];
    }
    return [];
  }
  return pathParam.map((p) => decodeURIComponent(trimPrefixSuffix(p, "/"))).filter((p) => p);
}

/**
 * Get the parent object of a path
 */
export async function getParent(bucket: R2Bucket, path: string): Promise<R2Object | R2ObjectAlike | null> {
  const parentPath = dirname(path);
  let parentDir: R2Object | R2ObjectAlike | null;
  if (parentPath === "" || parentPath === "/") {
    parentDir = ROOT_OBJECT;
  } else {
    // compatible with prior v0.1.17 dir object, which doesn't end with slash.
    parentDir = (await bucket.head(parentPath + "/")) || (await bucket.head(parentPath));
  }
  return parentDir;
}
