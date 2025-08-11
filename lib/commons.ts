import { z } from "zod";
import { sha256 as sha256Internal, hmac_sha256 } from "./sha256";

/**
 * The unix timestamp (milliseconds) of "past" time:
 * "2000-01-01T00:00:00.000Z"
 */
export const PAST_TIMESTAMP = 946684800000;

export const WEBDAV_ENDPOINT = "/dav/";
export const SHARE_ENDPOINT = "/s/";
export const THUMBNAIL_API = "/api/thumbnail";
export const SIGNOUT_API = "/api/signout";
export const SEARCH_API = "/api/search";
export const STATISTICS_API = "/api/statistics";
export const REINDEX_API = "/api/reindex";
export const CONFIG_API = "/api/config";

export const KEY_STATISTICS = "statistics";

export const KEY_GLOBAL_CONFIG = "globalConfig";

export const FORCR_VARIABLE = "force";

/**
 * Cloud Download default file size limit (bytes): 10MiB.
 */
export const CLOUD_DOWNLOAD_SIZE_LIMIT = 50 * 1024 * 1024;

export const ID_VARIABLE = "id";

export const THUMBNAIL_SIZE = 144;

/**
 * 13 monthes = 398 days.
 * See: https://stackoverflow.com/questions/62659149/why-was-398-days-chosen-for-tls-expiration
 */
export const THIRTEEN_MONTHS_DAYS = 398;

/**
 * thumbnail variable.
 * set to 1 to request or update the file's thumbnail.
 */
export const THUMBNAIL_VARIABLE = "thumbnail";

/**
 * url variable.
 * Only apply MIME_URL files. Set to the url of the file.
 * @see {MIME_URL}
 */
export const URL_VARIABLE = "url";

/**
 * Comment variable. R2 file customMetadata.
 */
export const COMMENT_VARIABLE = "comment";

/**
 * For thumbnail api: set to to the thumbnail file digest.
 */
export const THUMBNAIL_DIGEST_VARIABLE = "thumbnailDigest";

export const THUMBNAIL_NO404_VARIABLE = "thumbnailNo404";

/**
 * Display fallback thumbnail of that content type.
 */
export const THUMBNAIL_CONTENT_TYPE = "thumbnailContentType";

export const THUMBNAIL_COLOR_VARIABLE = "thumbnailColor";

export const THUMBNAIL_NOFALLBACK = "thumbnailNoFallback";

export const THUMBNAIL_EXT_VARIABLE = "thumbnailExt";

export const EXPIRES_VARIABLE = "expires";

export const SCOPE_VARIABLE = "scope";

export const TOKEN_VARIABLE = "token";

export const AUTH_VARIABLE = "auth";

export const DOWNLOAD_VARIABLE = "download";

export const META_VARIABLE = "meta";

export const FULL_CONTROL_VARIABLE = "fullControl";

/**
 * Convert .md or other type input file to and output in html format
 */
export const HTML_VARIABLE = "html";

/**
 * Request a JSON format output
 */
export const JSON_VARIABLE = "json";

/**
 * Output in raw format.
 */
export const RAW_VARIABLE = "raw";

/**
 * request timestamp to make each url unique. Do not participate in url signinng
 */
export const TS_VARIABLE = "_ts";

/**
 * Used in multipart upload.
 */
export const UPLOADS_VARIABLE = "uploads";
/**
 * Used in multipart upload.
 */
export const UPLOAD_ID_VARIABLE = "uploadId";
/**
 * Used in multipart upload.
 */
export const PART_NUMBER_VARIABLE = "partNumber";

// Note: don't use "as const" style declaration due to
// https://stackoverflow.com/questions/56565528/typescript-const-assertions-how-to-use-array-prototype-includes .
/**
 * simple "read" http methods: [GET, HEAD, OPTIONS, PROPFIND].
 * It includes PROPFIND method which is used by WebDAV protocol to list dir.
 */
export const METHODS_READ_DIR: readonly string[] = ["GET", "HEAD", "OPTIONS", "PROPFIND"];

/**
 * simple file "read" http methods: [GET, HEAD, OPTIONS].
 */
export const METHODS_READ_FILE: readonly string[] = ["GET", "HEAD", "OPTIONS"];

/**
 * These query string variables do not participate in signing:
 * [raw, html, json, meta, token, ts, url, comment, thumbnail*... (except thumbnailDigest)]
 */
export const NOSIGN_VARIABLES: readonly string[] = [
  RAW_VARIABLE,
  HTML_VARIABLE,
  JSON_VARIABLE,
  META_VARIABLE,
  TOKEN_VARIABLE,
  TS_VARIABLE,
  URL_VARIABLE,
  COMMENT_VARIABLE,
  THUMBNAIL_VARIABLE,
  THUMBNAIL_COLOR_VARIABLE,
  THUMBNAIL_CONTENT_TYPE,
  THUMBNAIL_EXT_VARIABLE,
  THUMBNAIL_NO404_VARIABLE,
  THUMBNAIL_NOFALLBACK,
  UPLOADS_VARIABLE,
  UPLOAD_ID_VARIABLE,
  PART_NUMBER_VARIABLE,
];

/**
 * private file url default valid time in milliseconds.
 * 86400 * 1000 = 1d.
 */
export const PRIVATE_URL_TTL = 86400 * 1000;

/**
 * A password of [a-zA-Z0-9]{length} is considered strong enough.
 * Each char is Math.log2(62) = 5.95 bit.
 * Password of 22 chars is 130 bit security.
 */
export const STRONG_PASSWORD_LENGTH = 22;

export const KEY_PREFIX_PRIVATE = ".flaredrive/";

export const KEY_PART_SEARCH = ".search";

export const KEY_PART_SEARCH_FULL = ".full";

/**
 * ".flaredrive/thumbnails/"
 */
export const KEY_PREFIX_THUMBNAIL = KEY_PREFIX_PRIVATE + "thumbnails/";

/**
 * Windows .url file extension
 */
export const EXT_URL = ".url";

/**
 * macOS .webloc file extension
 */
export const EXT_WEBLOC = ".webloc";

/**
 * Used for "url" files, such as Windows .url files, MacOS .webloc files.
 * This MIME is introduced by NextCloud.
 * These files will have a "url" custom metadata set.
 */
export const MIME_URL = "application/internet-shortcut";

/**
 * Fallback MIME for any type file
 */
export const MIME_DEFAULT = "application/octet-stream";

export const MIME_DIR = "application/x-directory";

export const MIME_XML = "application/xml";

export const MIME_HTML = "text/html";

export const MIME_MARKDOWN = "text/markdown";

export const MIME_TXT = "text/plain";

export const MIME_PDF = "application/pdf";

export const MIME_SH = "application/x-sh";

export const MIME_JS = "application/javascript";

export const MIME_JSON = "application/json";

export const MIME_ZIP = "application/zip";

export const MIME_GZIP = "application/gzip";

export const MIME_YAML = "application/yaml";

export const MIME_TOML = "application/toml";

/**
 * Textual mimes besides "txt/*": ["application/xml", "application/javascript", "application/json",
 *   "application/x-sh","application/yaml", "application/toml", "application/x-mswinurl"]
 */
export const TXT_MIMES: readonly string[] = [MIME_XML, MIME_JS, MIME_JSON, MIME_SH, MIME_YAML, MIME_TOML, MIME_URL];

export const HEADER_RANGE = "Range";

/**
 * Header used to indicate to server that do NOT generate thumbnail for uploaded file.
 */
export const HEADER_NO_THUMBNAIL = "X-No-Thumbnail";

/**
 * Header used to indicate that the request is authenticated.
 * For example, if the request has "Authorization" header with valid credentials.
 */
export const HEADER_AUTHED = "X-Authed";

export const HEADER_INAPP = "X-In-App";

/**
 * Directly upload file from other url
 */
export const HEADER_SOURCE_URL = "X-Source-Url";

export const HEADER_SOURCE_URL_OPTIONS = "X-Source-Url-Options";

/**
 * The "global" scope that indicates current user is the admin.
 */
export const SCOPE_GLOBAL = "/";

/**
 * Custom flag header sent by server to respond to "MKCOL" request.
 * It indicates that the target path already exists and is a dir.
 */
export const HEADER_DIR_EXISTS = "X-Dir-Exists";

/**
 * Header to tell server the thumbnail id (sha256) of the uploaded file
 */
export const HEADER_FD_THUMBNAIL = "X-Fd-Thumbnail";

export const HEADER_AUTHORIZATION = "Authorization";

export const HEADER_CONTENT_TYPE = "Content-Type";

export const HEADER_LOCATION = "Location";

export const HEADER_CONTENT_SECURITY_POLICY = "Content-Security-Policy";

/**
 * A restrictive Content-Security-Policy for serving user-provided content.
 * It uses 'sandbox' to prevent script execution, form submission, etc.
 * It allows inline styles and images from any source to provide a good viewing experience for sanitized HTML/Markdown.
 */
export const CONTENT_SECURITY_POLICY_SANDBOX =
  "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src * data:;";
// a more restrictive version:
// export const CONTENT_SECURITY_POLICY_SANDBOX = "sandbox; default-src 'none'; script-src 'none'; plugin-types 'none'; style-src 'self'; img-src 'self'";

export const HEADER_CONTENT_LENGTH = "Content-Length";

export const HEADER_ETAG = "ETag";

export const HEADER_RETRY_AFTER = "Retry-After";

export const HEADER_LAST_MODIFIED = "Last-Modified";

export const HEADER_IF_UNMODIFIED_SINCE = "If-Unmodified-Since";

export const HEADER_REFERER = "Referer";

export const HEADER_REFERRER_POLICY = "Referrer-Policy";

/**
 * CF image header.
 * See: https://developers.cloudflare.com/images/reference/troubleshooting/
 */
export const HEADER_CF_RESIZED = "Cf-Resized";

/**
 * WebDAV "PROPFIND" method Depth header
 */
export const HEADER_DEPTH = "Depth";

/**
 * WebDAV Destination header, used in server-side file move / copy.
 */
export const HEADER_DESTINATION = "Destination";

/**
 * WebDAV Overwrite header.
 * https://learn.microsoft.com/en-us/previous-versions/office/developer/exchange-server-2003/aa142944(v=exchg.65)
 */
export const HEADER_OVERWRITE = "Overwrite";

/**
 * Sent back by server. The client sent "Authorization" header value.
 */
export const HEADER_AUTH = "X-Auth";

/**
 * async upload mode
 */
export const HEADER_SOURCE_ASYNC = "X-Source-Async";

export const INDEX_FILE = "index.html";

/**
 * System files which only admin can manage / write / update:
 * [].
 */
export const SYSFILES: readonly string[] = [];

/**
 * Dir access permission.
 */
export enum Permission {
  /**
   * Request target file requires authentication for reading
   */
  RequireAuth,
  /**
   * Request target file is open (can be anonymously read)
   */
  OpenFile,
  /**
   * Request target file belongs to an open dir,
   * the whole dir with all inside files can be anonymously read / listed)
   */
  OpenDir,
  /**
   * Request target file belongs to an open dir,
   * the whole dir with all inside files can be anonymously read / listed / writed / updated)
   */
  OpenRwDir,
}

export enum ShareRefererMode {
  NoLimit = 0,
  WhitelistMode = 1,
  BlackListMode = 2,
}

export interface ShareObject {
  /**
   * file key. If it ends with "/", treat it as a dir share.
   */
  key: string;
  /**
   * optional. share expires unix timestamp (miliseconds).
   * Negative or zero value means no expiration.
   * Note: in <= v0.1.7 versions it was seconds.
   * If "hardShareExpiration" global config is true, it's also set as KV key expiration option.
   */
  expiration?: number;

  /**
   * Referer white or black list.
   * An empty string matches with no referer or empty referer.
   */
  refererList?: string[];

  /**
   * Referer restriction mode. By default is no limit (0).
   */
  refererMode?: ShareRefererMode;

  /**
   * Apply referer restriction to direct request (no or empty referer) also.
   */
  refererModeEmpty?: boolean;

  /**
   * "username:password" format auth credentials.
   */
  auth?: string;

  /**
   * Optional share description
   */
  desc?: string;

  /**
   * Optional share comment (only visible to admin)
   */
  comment?: string;

  /**
   * optional, disable directory index page.
   */
  noindex?: boolean;

  /**
   * optional, full html mode. render .html files in full mode instead of sandbox mode.
   * Note: enabling it could introduce XSS vulnerabilities.
   */
  fullHtml?: boolean;

  /**
   * CORS policy. 0 or undefined - disable. 1 - enable.
   */
  cors?: number;
}

export interface ThumbnailObject {
  digest: string;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
};

export function dirname(path: string): string {
  path = trimPrefixSuffix(path, "/");
  return path.split(/[\\/]/).slice(0, -1).join("/");
}

export function basename(path: string): string {
  path = trimPrefixSuffix(path, "/");
  return path.split(/[\\/]/).pop()!;
}

export function parseFilePath(path: string): { dirname: string; basename: string; ext: string; base: string } {
  path = trimPrefixSuffix(path, "/");
  const pathes = path.split(/[\\/]/);
  const dirname = pathes.slice(0, -1).join("/");
  const basename = pathes[pathes.length - 1];
  const ext = extname(basename);
  const base = basename.slice(0, basename.length - ext.length);
  return { dirname, basename, ext, base };
}

export function humanReadableSize(size: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (size >= 1024) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export function trimSuffix(str: string, suffix: string): string {
  if (str.endsWith(suffix)) {
    str = str.slice(0, str.length - suffix.length);
  }
  return str;
}

export function trimPrefix(str: string, prefix: string): string {
  if (str.startsWith(prefix)) {
    str = str.slice(prefix.length);
  }
  return str;
}

/**
 * Simliar to Go strings.Cut function. cut("user:pass", ":") => ["user", "pass", true]
 * @param str
 * @param deli
 * @returns [before, after, found]
 */
export function cut(str: string, deli: string): [string, string, boolean] {
  const i = str.indexOf(deli);
  if (i === -1) {
    return [str, "", false];
  }
  return [str.slice(0, i), str.slice(i + 1), true];
}

export function trimPrefixSuffix(str: string, prefixSuffix: string): string {
  return trimSuffix(trimPrefix(str, prefixSuffix), prefixSuffix);
}

export function cleanPath(path: string): string {
  path = path.trim();
  if (path == "/") {
    return path;
  }
  path = trimSuffix(path, "/");
  return path;
}

export function path2Key(path: string): string {
  path = trimPrefixSuffix(path.trim(), "/");
  path = decodeURI(path);
  return path;
}

export function key2Path(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/**
 * Convert str to int. If str is null / undefined / empty / invalid (NaN), return defaultValue
 * @param str
 * @param defaultValue Optional, default is 0 (zero).
 * @returns
 */
export function str2int(str?: string | undefined | null, defaultValue = 0): number {
  if (!str) {
    return defaultValue;
  }
  const value = parseInt(str);
  if (isNaN(value)) {
    return defaultValue;
  }
  return value;
}

export function isHttpsOrLocalUrl(url: string): boolean {
  return (
    url.startsWith("https://") ||
    url.startsWith("http://localhost:") ||
    url.startsWith("http://localhost/") ||
    url.startsWith("http://127.0.0.1:") ||
    url.startsWith("http://127.0.0.1/")
  );
}

/**
 * Return the extension (with dot) of a file path. E.g. "foo/bar.txt" => ".txt".
 * Return empty string if last segment of path does not contain a dot.
 */
export function extname(path: string): string {
  const lastDotIndex = path.lastIndexOf(".");
  if (lastDotIndex < 0) {
    return "";
  }
  const lastSlashIndex = path.lastIndexOf("/");
  if (lastSlashIndex > lastDotIndex) {
    return "";
  }
  return path.substring(lastDotIndex);
}

/**
 * Compare a and b, return -1, 0 or 1. undefined or null is treated as empty string.
 * @param a
 * @param b
 * @returns
 */
export function compareString(a: string | undefined | null, b: string | undefined | null): number {
  a = a || "";
  b = b || "";
  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  } else {
    return 0;
  }
}

/**
 * Compare boolean a and b, return -1, 0 or 1. false < true. Treat undefined as false.
 * @param a
 * @param b
 * @returns
 */
export function compareBoolean(a: boolean | undefined, b: boolean | undefined): number {
  if (!a && b) {
    return -1;
  } else if (a && !b) {
    return 1;
  } else {
    return 0;
  }
}
export function encodeHex(input?: Uint8Array | ArrayBuffer): string {
  if (!input) {
    return "";
  }
  let result = "";
  const array = "buffer" in input ? new Uint8Array(input.buffer) : new Uint8Array(input);
  for (const value of array) {
    result += value.toString(16).padStart(2, "0");
  }
  return result;
}

export function decodeHex(str: string): Uint8Array {
  const uint8array = new Uint8Array(Math.ceil(str.length / 2));
  for (let i = 0; i < str.length; ) {
    uint8array[i / 2] = Number.parseInt(str.slice(i, (i += 2)), 16);
  }
  return uint8array;
}

async function getHMACKey(key: string): Promise<CryptoKey> {
  const cryptokey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    {
      name: "HMAC",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign", "verify"]
  );
  return cryptokey;
}

export async function hmacSha256Sign(key: string, payload: string): Promise<string> {
  const singkey = await getHMACKey(key);
  const signature = await crypto.subtle.sign("HMAC", singkey, new TextEncoder().encode(payload));
  return encodeHex(new Uint8Array(signature));
}

export function hmacSha256SignSync(key: string, payload: string): string {
  const signature = hmac_sha256(key, payload);
  return encodeHex(signature);
}

export async function hmacSha256Verify(key: string, signature: string, payload: string): Promise<boolean> {
  const singkey = await getHMACKey(key);
  const verified = await crypto.subtle.verify("HMAC", singkey, decodeHex(signature), new TextEncoder().encode(payload));
  return verified;
}

/**
 * Performs a constant-time comparison of two strings or Uint8Arrays.
 * This is crucial for comparing secrets (like passwords or HMACs) to prevent timing attacks.
 * @param a The first string or Uint8Array.
 * @param b The second string or Uint8Array.
 * @returns True if the inputs are identical, false otherwise.
 */
export function constantTimeCompare(a: string | Uint8Array, b: string | Uint8Array): boolean {
  const aBytes = typeof a === "string" ? new TextEncoder().encode(a) : a;
  const bBytes = typeof b === "string" ? new TextEncoder().encode(b) : b;

  if (aBytes.byteLength !== bBytes.byteLength) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < aBytes.byteLength; i++) {
    result |= aBytes[i] ^ bBytes[i]; // XOR bytes and accumulate result
  }

  // If result is 0, all bytes were identical.
  return result === 0;
}

function signUrl({
  key,
  pathname,
  searchParams,
  origin = "",
}: {
  key: string;
  pathname: string;
  searchParams?: URLSearchParams;
  origin?: string;
}): string {
  const signSearchParams = new URLSearchParams(searchParams);
  for (const param of NOSIGN_VARIABLES) {
    signSearchParams.delete(param);
  }
  signSearchParams.sort();
  const payload =
    (!signSearchParams.has(SCOPE_VARIABLE) ? pathname : "") +
    (signSearchParams.size ? "?" + signSearchParams.toString() : "");
  const signature = hmacSha256SignSync(key, payload);
  const qs = searchParams ? searchParams.toString() : "";
  return `${origin}${pathname}?${qs}${qs ? "&" : ""}${TOKEN_VARIABLE}=${encodeURIComponent(signature)}`;
}

/**
 * Get url path of a dir file key. "foo/demo bar" => "/foo/demo%20bar/"
 * @param dirkey
 * @returns
 */
export function dirUrlPath(dirkey: string): string {
  dirkey = (!dirkey.startsWith("/") ? "/" : "") + encodeURI(dirkey);
  dirkey += !dirkey.endsWith("/") ? "/" : "";
  return dirkey;
}

/**
 * Generate file access url. If auth is set, the url will be signed by it.
 * @param expires: file link expiration unix timestamp (microseconds). 0 == infinite.
 * @returns
 */
export function fileUrl({
  key,
  auth,
  token,
  expires = 0,
  ts = 0,
  origin = "",
  scope = "",
  thumbnail = false,
  thumbnailNo404 = false,
  thumbNoFallback = false,
  thumbnailColor = "",
  thumbnailContentType = "",
  fullControl = false,
  isDir = false,
  raw = false,
}: {
  key: string;
  token?: string | null;
  auth?: string | null;
  expires?: number;
  ts?: number;
  origin?: string;
  scope?: string | null;
  /**
   * true, or digest
   */
  thumbnail?: boolean | string;
  thumbnailNo404?: boolean;
  thumbNoFallback?: boolean;
  thumbnailColor?: string;
  thumbnailContentType?: string;
  fullControl?: boolean;
  isDir?: boolean;
  raw?: boolean;
}): string {
  const searchParams = new URLSearchParams();
  if (auth || token) {
    if (expires) {
      searchParams.set(EXPIRES_VARIABLE, `${expires}`);
    }
    if (fullControl) {
      searchParams.set(FULL_CONTROL_VARIABLE, "1");
    }
    if (token) {
      searchParams.set(TOKEN_VARIABLE, token);
    }
    if (scope) {
      searchParams.set(SCOPE_VARIABLE, scope);
    }
  }
  if (thumbnail) {
    if (auth && typeof thumbnail == "string") {
      searchParams.set(THUMBNAIL_DIGEST_VARIABLE, thumbnail);
    } else {
      searchParams.set(THUMBNAIL_VARIABLE, "1");
    }
    if (thumbnailNo404) {
      searchParams.set(THUMBNAIL_NO404_VARIABLE, "1");
    }
    if (thumbNoFallback) {
      searchParams.set(THUMBNAIL_NOFALLBACK, "1");
    }
    if (thumbnailColor) {
      searchParams.set(THUMBNAIL_COLOR_VARIABLE, thumbnailColor);
    }
    if (thumbnailContentType) {
      searchParams.set(THUMBNAIL_CONTENT_TYPE, thumbnailContentType);
    }
  }
  if (ts) {
    searchParams.set(TS_VARIABLE, `${ts}`);
  }
  if (raw) {
    searchParams.set(RAW_VARIABLE, "1");
  }
  let pathname: string;
  if (isDir) {
    pathname = dirUrlPath(key);
  } else if (auth && thumbnail) {
    pathname = THUMBNAIL_API;
  } else {
    pathname = `${WEBDAV_ENDPOINT}${key2Path(key)}`;
  }
  if (!auth) {
    return origin + pathname + (searchParams.size ? "?" + searchParams.toString() : "");
  }
  return signUrl({ key: auth, pathname, searchParams, origin });
}

/**
 * Return sha-256 digest hex string of a blob / string / ArrayBuffer / TypedArray
 * @param blob
 * @returns
 */
export async function sha256(content: Blob | string | ArrayBuffer | { buffer: ArrayBufferLike }) {
  let input: ArrayBuffer;
  if (typeof content == "string") {
    input = new TextEncoder().encode(content);
  } else if (content instanceof Blob) {
    input = await content.arrayBuffer();
  } else if ("buffer" in content) {
    input = content.buffer;
  } else {
    input = content;
  }
  const digest = await crypto.subtle.digest("SHA-256", input);
  const digestArray = Array.from(new Uint8Array(digest));
  const digestHex = digestArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return digestHex;
}

/**
 * Synchronously return sha-256 digest hex string of a string / ArrayBuffer / TypedArray
 * @param blob
 * @returns
 */
export function sha256Sync(content: string | ArrayBuffer | { buffer: ArrayBufferLike }): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let input: any;
  if (content instanceof ArrayBuffer) {
    input = new Uint8Array(content);
  } else {
    input = content;
  }
  return encodeHex(sha256Internal(input) as Uint8Array);
}

export function headers2Obj(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

export function basicAuthorizationHeader(user: string, pass: string): string {
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

/**
 * Return true is auth is likely a http basic authorization header (starts with `Basic `)
 * @param auth
 * @returns
 */
export function isBasicAuthHeader(auth: string): boolean {
  return auth.startsWith(`Basic `);
}

/**
 * Parse "Content-Type" header, return mime and it's category:
 * E.g. `Text/HTML;Charset="utf-8"` => ["text/html", "text"].
 * If input is null / undefined / empty, return ["", ""].
 * @param contentType
 * @returns
 */
export function mimeType(contentType?: string | null): [string, string] {
  if (!contentType) {
    return ["", ""];
  }
  let [mime] = cut(contentType, ";");
  mime = mime.toLowerCase();
  const [mimeCat] = cut(mime, "/");
  return [mime, mimeCat];
}

/**
 * Return the unix timestamp (miniseconds) of the end of the next day. Use UTC time.
 * E.g. if now is (UTC time) 01-02 15:04, return timestamp of 01-04 00:00.
 */
export function nextDayEndTimestamp(): number {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + 2);
  now.setUTCHours(0);
  now.setUTCMinutes(0);
  now.setUTCSeconds(0, 0);
  return +now;
}

export function appendQueryStringToUrl(url: string, qs: string): string {
  if (qs.startsWith("?") || qs.startsWith("&")) {
    qs = qs.slice(1);
  }
  if (url.includes("?")) {
    if (!url.endsWith("&")) {
      url += "&";
    }
  } else {
    url += "?";
  }
  url += qs;
  return url;
}

/**
 * httpMetadata?.contentType?: string
 */
interface R2ObjectAlike {
  httpMetadata?: {
    contentType?: string;
  };
}

/**
 * Return whether the R2Object is a html file
 */
export function isHtml(object: R2ObjectAlike): boolean {
  return (
    object.httpMetadata?.contentType === MIME_HTML || !!object.httpMetadata?.contentType?.startsWith(MIME_HTML + ";")
  );
}

/**
 * Return whether the R2Object is a image file
 */
export function isImage(object: R2ObjectAlike): boolean {
  return object.httpMetadata?.contentType?.startsWith("image/") || false;
}

/**
 * Return whether the R2Object is a audio file
 */
export function isAudio(object: R2ObjectAlike): boolean {
  return object.httpMetadata?.contentType?.startsWith("audio/") || false;
}

/**
 * Return whether an R2Object or alike is a dir
 */
export function isDirectory(object: R2ObjectAlike): boolean {
  return object.httpMetadata?.contentType === MIME_DIR;
}

/**
 * Return whether an R2Object or alike is a url (internet shortcut) file
 */
export function isUrlFile(object: R2ObjectAlike): boolean {
  return object.httpMetadata?.contentType === MIME_URL;
}

/**
 * Return depth of R2 file key.
 * E.g. "foo" => 0; "foo/bar" => 1.
 */
export function fileDepth(key: string): number {
  if (!key) {
    return 0;
  }
  key = trimPrefixSuffix(key, "/");
  return key.split(/[\\/]/).length - 1; // Count the number of slashes
}

/**
 * Join pathes by "/". Ignore empty path.
 */
export function joinPathes(...pathes: string[]): string {
  return pathes
    .map((p) => trimPrefixSuffix(p, "/"))
    .filter((p) => p.length > 0)
    .join("/");
}

/**
 * Return true if prefix is a non-empty string and doesn't start or end with whitespace or "/".
 * @param prefix
 * @returns
 */
function validatePrefix(prefix: string): boolean {
  const normalizedPrefix = trimPrefixSuffix(prefix.trim(), "/").trim();
  return !!normalizedPrefix && normalizedPrefix === prefix;
}

/**
 * Return true if shareName is a non-empty string, doesn't start or end with whitespace, and doesn't contain "/".
 * @param shareName
 * @returns
 */
function validateShareName(shareName: string): boolean {
  const normalized = shareName.trim();
  return !!shareName && normalized === shareName && !shareName.includes("/");
}

const INVALID_PREFIX_MESSAGE = `prefix must NOT be empty or start or end with whitespace or "/" char`;
const INVALID_SHARE_NAME_MESSAGE = `shareName must NOT be empty or start or end with whitespace or contain "/" char`;

// The zod schema of PublicConfig. All fields default to "zero" values.
export const PublicConfigSchema = z
  .object({
    /**
     * inticates that server status is ok.
     */
    ok: z.boolean().default(false),
    /**
     * dev mode
     */
    dev: z.boolean().default(false),
    /**
     * Public prefix list. Each one in list is guaranteed to be not empty
     * and do not start or end with white space or "/".
     */
    publicPrefix: z.array(z.string().refine(validatePrefix, { message: INVALID_PREFIX_MESSAGE })).default([]),
    /**
     * Public dir prefix list. Each one in list is guaranteed to be not empty
     * and do not start or end with white space or "/".
     */
    publicDirPrefix: z.array(z.string().refine(validatePrefix, { message: INVALID_PREFIX_MESSAGE })).default([]),
    /**
     * Public writable dir prefix list. Each one in list is guaranteed to be not empty
     * and do not start or end with white space or "/".
     */
    publicRwdirPrefix: z.array(z.string().refine(validatePrefix, { message: INVALID_PREFIX_MESSAGE })).default([]),
  })
  .strict();

/**
 * The public visible parts of global config.
 */
export type PublicConfig = z.infer<typeof PublicConfigSchema>;

export const GlobalConfigSchema = PublicConfigSchema.extend({
  /**
   * config comment.
   */
  comment: z.string().default(""),

  /**
   * Mapping path prefix to share.
   * E.g. if "foo/bar" => "tmp", then visiting "/foo/bar/" equals with "/s/tmp/" .
   * Require prefixes be configured in wrangler "run_worker_first" array.
   */
  mappings: z
    .record(
      z.string().refine(validatePrefix, { message: INVALID_PREFIX_MESSAGE }),
      z.string().refine(validateShareName, { message: INVALID_SHARE_NAME_MESSAGE })
    )
    .default({}),

  /**
   * If set to true, the share KV object will be automatically deleted after expiration.
   */
  hardShareExpiration: z.boolean().default(false),

  /**
   * build-time config
   */
  buildConfig: z.any().default(null),
}).strict();

/**
 * Extended version of PublicConfig.
 * Add some privileged (admin only visible) configurations,
 * which will be set to empty values if current user is not admin.
 */
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

/**
 * The MD5 of empty input (nothing)
 */
export const EMPTY_MD5 = "d41d8cd98f00b204e9800998ecf8427e";

export const EMPTY_MD5_RAW = decodeHex(EMPTY_MD5);

export const FALLBACK_URL = "about:blank";

/**
 * Make sure url is valid and safe (no XSS vulnerability).
 * Return sanitized url if it's safe, otherwise return empty string.
 */
export function validateAndGetSafeUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    // Allow only specific protocols
    if (!["http:", "https:", "ftp:", "mailto:"].includes(parsedUrl.protocol)) {
      return "";
    }
    return parsedUrl.href;
  } catch (error) {
    console.error("Invalid URL:", error);
    return "";
  }
}

// Return a new file name based on provided name:
// If name is in "foo (1)" style, return "foo (2)"
// Otherwise (the name is in "foo" style), return "foo (1)".
export function newFileName(name: string): string {
  const match = name.match(/^(.*?)( \((\d+)\))?$/);
  if (!match) {
    return `${name} (1)`;
  }
  const [, baseName, , indexStr] = match;
  const index = indexStr ? parseInt(indexStr, 10) + 1 : 1;
  return `${baseName} (${index})`;
}

/**
 * Checks if a value is "zero-like".
 * This includes null, undefined, false, 0, empty strings,
 * @param value The value to check.
 * @returns True if the value is "zero-like", otherwise false.
 */
export function isZeroValue(value: unknown): boolean {
  // Standard falsy values, plus the number 0 and boolean false
  if (value === null || value === undefined || value === "" || value === 0 || value === false) {
    return true;
  }
  return false;
}

/**
 * Recursively removes fields from an object that have "zero-like" values.
 * It handles nested objects and arrays. The function is type-safe and
 * does not mutate the original object.
 *
 * "Zero-like" values are: 0, "", false, null, undefined.
 *
 * @template T The type of the object.
 * @param {T} obj The object to process.
 * @returns {T} A new object with zero-like fields removed. The return
 * type is T for ergonomic reasons, although technically some
 * optional properties may have been removed. Accessing a removed
 * property will result in `undefined`, which is consistent with
 * its optional nature.
 */
export function removeZeroFields<T extends object>(obj: T): T {
  // Return primitives and null as-is. This is the recursion base case
  // for values inside arrays or objects.
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  // Handle arrays: recursively process each item.
  // This creates a new array containing only non-zero items.
  if (Array.isArray(obj)) {
    return (
      obj
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item) => removeZeroFields(item as any)) // Recursively clean each item
        .filter((item) => !isZeroValue(item)) as T
    ); // Filter out any items that became "zero"
  }

  // Handle objects: build a new object, including only non-zero values.
  // We use `reduce` to construct the new object.
  return Object.keys(obj).reduce((acc, key) => {
    const k = key as keyof T;
    let value = obj[k]; // Get the original value

    // If the value is an object (and not null), recurse.
    if (typeof value === "object" && value !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value = removeZeroFields(value as any);
    }

    // Only add the key to the new object if its final value is not "zero-like".
    if (!isZeroValue(value)) {
      acc[k] = value;
    }

    return acc;
  }, {} as T); // Start with an empty object of type T
}
