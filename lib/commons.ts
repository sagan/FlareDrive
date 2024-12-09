export const WEBDAV_ENDPOINT = "/dav/";
export const SHARE_ENDPOINT = "/s/";

export const HEADER_AUTHED = "X-Authed";

export const HEADER_PERMISSION = "X-Permission";

export enum Permission {
  /**
   * Request target file is open (can be anonymously read)
   */
  OpenFile = 0,
  /**
   * Request target file belongs to an open dir,
   * the whole dir with all inside files can be anonymously read / listed)
   */
  OpenDir = 1,
  /**
   * Request target file requires authentication for reading
   */
  RequireAuth = 3,
}

export interface ShareObject {
  /**
   * file key.
   */
  key: string;
  /**
   * optional. share expires unix timestamp (seconds)
   * It's set as KV key expiration metadata. Howver, the KV API has no way to get this value after set.
   * So we also store it as a data field.
   */
  expiration?: number;
}

export function basename(path: string): string {
  return path.split(/[\\/]/).pop() as string;
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

export function path2Prefix(path: string): string {
  path = trimPrefixSuffix(path.trim(), "/");
  if (path) {
    path += "/";
  }
  return path;
}

export function key2Path(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}
