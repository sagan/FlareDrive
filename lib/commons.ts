export const WEBDAV_ENDPOINT = "/dav/";
export const SHARE_ENDPOINT = "/s/";

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

export enum Permission {
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
   * file key.
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
   * Referer restriction mode. By default is no limit.
   */
  refererMode?: ShareRefererMode;
}

export function dirname(path: string): string {
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

export function isHttpsOrLocalOrigin(origin: string): boolean {
  return (
    origin.startsWith("https://") ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin === "http://localhost" ||
    origin === "http://127.0.0.1"
  );
}

export function extname(path: string): string {
  if (!path.includes(".")) {
    return "";
  }
  return "." + path.split(".").pop();
}
