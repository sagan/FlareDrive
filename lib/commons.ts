export const WEBDAV_ENDPOINT = "/dav/";

export interface ShareObject {
  /**
   * state: 1 - shared.
   */
  state: number;
  /**
   * share expires unix timestamp (seconds)
   */
  expires: number;
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
