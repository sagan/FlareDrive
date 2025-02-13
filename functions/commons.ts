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
  SHARE_ENDPOINT,
  SCOPE_VARIABLE,
  WEBDAV_ENDPOINT,
  HEADER_CF_RESIZED,
  MIME_HTML,
  MIME_MARKDOWN,
  sha256,
  hmacSha256Verify,
  key2Path,
  str2int,
  fileUrl,
  basicAuthorizationHeader,
  trimPrefix,
  path2Key,
  trimPrefixSuffix,
  corsHeaders,
} from "../lib/commons";

export type FdCfFuncContext = EventContext<
  {
    /**
     * Flag. set it to any value (e.g. "1") to lift cloud download size limitation.
     */
    CLOUD_DOWNLOAD_UNLIMITED?: string;
    WEBDAV_USERNAME: string;
    WEBDAV_PASSWORD: string;
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
     * optional bucket public access url (without trailing "/"), e.g. "http://bucket-secret.example.com".
     * It is suggested to keep this url secret (choose a private & complex custom sub domain).
     * It's only used by functions/* and will not be leaked to front end.
     */
    BUCKET_URL?: string;
    /**
     * associated worker url. Must enable CloudFlare images transformation in worker domain zone.
     */
    WORKER_URL?: string;
    /**
     * associated worker token
     */
    WORKER_TOKEN?: string;
    SITENAME?: string;
    BUCKET: R2Bucket;
    KV?: KVNamespace;
    [key: string]: any;
  },
  string, // params key type
  Record<string, unknown> // data type
>;

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
export function responseConflict(): Response {
  return new Response("Conflict", { status: 409 });
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
    return jsonResponse(body, 201);
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
export function responseRedirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
    },
  });
}

/**
 * Return 405 Method Not Allowed response
 */
export function responseMethodNotAllowed(): Response {
  return new Response("Method not allowed", { status: 405 });
}

/**
 * Return a json response of obj, status is by default 200.
 * @param obj
 * @param status
 * @returns
 */
export function jsonResponse<T = any>(obj: T, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      [HEADER_CONTENT_TYPE]: "application/json",
    },
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
 * If authentication fails, return a failure response.
 * Otherwise return null.
 * Besides, return auth's valid scope
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

  if (token) {
    authed = await (async () => {
      const expires = str2int(searchParams.get(EXPIRES_VARIABLE));
      const fullControl = str2int(searchParams.get(FULL_CONTROL_VARIABLE));
      if ((expires > 0 && expires <= +new Date()) || (!fullControl && !METHODS_READ_DIR.includes(request.method))) {
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
        if (key !== scope && !key.startsWith(scope + "/")) {
          return false;
        }
      }
      payload += searchParams.size ? "?" + searchParams.toString() : "";
      return await hmacSha256Verify(expectedAuth, token, payload);
    })();
  } else {
    authed = auth === expectedAuth;
  }

  if (!authed) {
    if (url.pathname.startsWith(SHARE_ENDPOINT) && METHODS_READ_DIR.includes(request.method)) {
      const basicAuthHeader: Record<string, string> = { "WWW-Authenticate": `Basic realm="${encodeURI(realm)}"` };
      return [responseUnauthorized(basicAuthHeader), scope];
    }
    return [responseUnauthorized(), scope];
  }
  return [null, scope];
}

export async function* listAll(bucket: R2Bucket, prefix?: string, isRecursive: boolean = false) {
  let cursor: string | undefined = undefined;
  do {
    var r2Objects = await bucket.list({
      prefix: prefix,
      delimiter: isRecursive ? undefined : "/",
      cursor: cursor,
      // @ts-ignore
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

export async function findChildren({ bucket, path, depth }: { bucket: R2Bucket; path: string; depth: string }) {
  if (!["1", "infinity"].includes(depth)) {
    return [];
  }
  const objects: Array<R2Object> = [];

  const prefix = path === "" ? path : `${path}/`;
  for await (const object of listAll(bucket, prefix, depth === "infinity")) {
    objects.push(object);
  }

  return objects;
}

export async function generateFileThumbnail({
  auth,
  bucket,
  key,
  force,
  origin,
  originIsBucket,
  expires,
  thumbSize,
  workerUrl,
  workerToken,
}: {
  auth: string | null;
  bucket: R2Bucket;
  key: string;
  force: boolean;
  origin: string;
  originIsBucket: boolean;
  thumbSize: number;
  expires: number;
  workerUrl: string;
  workerToken: string;
}): Promise<number> {
  if (!key) {
    return 1;
  }
  const file = await bucket.get(key);
  if (!file || !file.httpMetadata?.contentType?.startsWith("image/")) {
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

  // Note: must put auth info in target url, cann't put it in options.headers,
  // As it seems CF worker strip "Authorization" header from sub-requests that's inside request of worker.
  const targetFileUrl = originIsBucket ? origin + "/" + key2Path(key) : fileUrl({ key, auth, origin, expires });
  const thumbResponse = await fetch(workerUrl, {
    method: "POST",
    headers: {
      [HEADER_CONTENT_TYPE]: "application/json",
    },
    body: JSON.stringify({
      token: workerToken,
      url: targetFileUrl,
      options: {
        cf: { image: { width: thumbSize, height: thumbSize, fit: "scale-down" } },
      },
    }),
  });
  if (!thumbResponse.ok) {
    throw new Error(`status=${thumbResponse.status}, targetFileUrl=${targetFileUrl}`);
  }
  if (!thumbResponse.headers.get(HEADER_CF_RESIZED)) {
    return 4;
  }
  let thumbResponseSize = str2int(thumbResponse.headers.get(HEADER_CONTENT_LENGTH));
  if (!thumbResponseSize || thumbResponseSize >= file.size) {
    return 5;
  }
  const thumbContents = await thumbResponse.blob();
  const thumbContentsDigest = await sha256(thumbContents);
  if (thumbFile && file.customMetadata?.thumbnail === thumbContentsDigest) {
    // new thumbnail file is same as old
    return 6;
  }
  // The only way to modify object metadata is to re-upload the object and set the metadata.
  await bucket.put(KEY_PREFIX_THUMBNAIL + thumbContentsDigest, thumbContents, { httpMetadata: thumbResponse.headers });
  await bucket.put(key, file.body, {
    httpMetadata: file.httpMetadata,
    customMetadata: Object.assign({}, file.customMetadata, { thumbnail: thumbContentsDigest }),
  });
  if (thumbFile) {
    // delete old thumbnail file
    await bucket.delete(thumbFile.key);
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
 * @param download bool If true, send "Content-Disposition: attachment" header.
 * @param cors bool If true, send CORS Allow All headers
 */
export async function outputR2Object({
  obj,
  download,
  html,
  cors,
}: {
  obj: R2ObjectBody;
  download?: boolean;
  html?: boolean;
  cors?: boolean;
}): Promise<Response> {
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
  if (html && obj.httpMetadata?.contentType == MIME_MARKDOWN) {
    const body = await obj.text();
    const htmlOutput = await marked.parse(body);
    const sanitizedHtml = sanitizeHtml(htmlOutput);
    headers.set(HEADER_CONTENT_TYPE, MIME_HTML);
    headers.delete(HEADER_CONTENT_LENGTH);
    return new Response(sanitizedHtml, { headers });
  }
  // headers.set("Cache-Control", "max-age=31536000");
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
