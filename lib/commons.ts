import { hmac_sha256 } from "./sha256";

export const WEBDAV_ENDPOINT = "/dav/";
export const SHARE_ENDPOINT = "/s/";
export const THUMBNAIL_API = "/api/thumbnail";
export const SIGNOUT_API = "/api/signout";

export const THUMBNAIL_SIZE = 144;

/**
 * private file url default valid time in milliseconds.
 * 86400 * 1000 = 1d.
 */
export const PRIVATE_URL_TTL = 86400 * 1000;

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

/**
 * ".flaredrive/thumbnails/"
 */
export const KEY_PREFIX_THUMBNAIL = KEY_PREFIX_PRIVATE + "thumbnails/";

export const MIME_DIR = "application/x-directory";

export const MIME_XML = "application/xml";

export const HEADER_AUTHED = "X-Authed";

export const HEADER_PERMISSION = "X-Permission";

export const HEADER_INAPP = "X-In-App";

export const HEADER_FD_THUMBNAIL = "X-Fd-Thumbnail";

/**
 * Sent back by server. The client sent "Authorization" header value.
 */
export const HEADER_AUTH = "X-Auth";

/**
 * Dir access permission. All values (except Unknown) > 0; Unknown is 0.
 */
export enum Permission {
  /**
   * Unknown permission
   */
  Unknown = 0,
  /**
   * Request target file is open (can be anonymously read)
   */
  OpenFile = 1,
  /**
   * Request target file belongs to an open dir,
   * the whole dir with all inside files can be anonymously read / listed)
   */
  OpenDir = 2,
  /**
   * Request target file requires authentication for reading
   */
  RequireAuth = 3,
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
   * optional. share expires unix timestamp (seconds)
   * It's set as KV key expiration option. However, the KV API has no way to get this value after set.
   * So we also store it as a data field.
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
   * "username:password" format auth credentials.
   */
  auth?: string;

  /**
   * Optional share description
   */
  desc?: string;

  /**
   * optional, disable directory index page.
   */
  noindex?: boolean;

  /**
   * CORS policy. 0 or undefined - disable. 1 - enable.
   */
  cors?: number;
}

/**
 * "Access-Control-Allow-Origin": "*"
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
};

export function dirname(path: string): string {
  path = trimPrefixSuffix(path, "/");
  return path.split(/[\\/]/).slice(0, -1).join("/");
}

export function basename(path: string): string {
  return path.split(/[\\/]/).pop()!;
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

export function extname(path: string): string {
  if (!path.includes(".")) {
    return "";
  }
  return "." + path.split(".").pop();
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

export function encodeHex(array: Uint8Array): string {
  let result = "";
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
  return encodeHex(new Uint8Array(signature));
}

export async function hmacSha256Verify(key: string, signature: string, payload: string): Promise<boolean> {
  const singkey = await getHMACKey(key);
  const verified = await crypto.subtle.verify("HMAC", singkey, decodeHex(signature), new TextEncoder().encode(payload));
  return verified;
}

export function fileUrl(key: string, auth: string | null, expires = 0, origin = ""): string {
  const searchParams = new URLSearchParams();
  if (auth && expires > 0) {
    searchParams.set("expires", `${expires}`);
  }
  searchParams.sort();
  const url = `${WEBDAV_ENDPOINT}${key2Path(key)}` + (searchParams.size ? "?" : "") + searchParams.toString();
  const signature = auth ? hmacSha256SignSync(auth, url) : "";
  return (
    origin + url + `${signature ? (searchParams.size ? "&" : "?") + "token=" + encodeURIComponent(signature) : ""}`
  );
}

export function thumbnailUrl(key: string, digest: string, color: string, auth: string | null, expires = 0): string {
  const searchParams = new URLSearchParams(
    `digest=${digest}&no404=1&color=${color}` + `&ext=${encodeURIComponent(extname(key))}`
  );
  if (auth && expires > 0) {
    searchParams.set("expires", `${expires}`);
  }
  searchParams.sort();
  const url = THUMBNAIL_API + (searchParams.size ? "?" : "") + searchParams.toString();
  const signature = auth ? hmacSha256SignSync(auth, url) : "";
  return url + `${signature ? (searchParams.size ? "&" : "?") + "token=" + encodeURIComponent(signature) : ""}`;
}
<<<<<<< HEAD

/**
 * Return sha-256 digest hex string of a blob
 * @param blob
 * @returns
 */
export async function sha256Blob(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const digestArray = Array.from(new Uint8Array(digest));
  const digestHex = digestArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return digestHex;
}
=======
>>>>>>> 0bc506bbba11926acd1c7bcfad8f8556d465964c
