import { SyntheticEvent } from "react";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import {
  KEY_PART_SEARCH,
  KEY_PART_SEARCH_FULL,
  MIME_DEFAULT,
  MIME_MARKDOWN,
  MIME_TXT,
  TXT_MIMES,
  Permission,
  mimeType,
  PublicSystemConfig,
} from "../lib/commons";
import React from "react";

/**
 * GitHub rule:
 *  /^readme\.(?:markdown|mdown|mkdn|md|textile|rdoc|org|creole|mediawiki|wiki|rst|asciidoc|adoc|asc|pod|txt)/i
 * For simplicity, we only handle common names: ["README.md", "README.txt", "readme.md", "readme.txt"].
 */
export const README_FILES = ["README.md", "README.txt", "readme.md", "readme.txt"];

export const VIEWMODE_VARIABLE = "viewMode";

export const SORT_VARIABLE = "sort";

export const EDITOR_PROMPT_VARIABLE = "editorPrompt";

export const EDITOR_READ_ONLY_VARIABLE = "editorReadOnly";

/**
 * Edit file size limiit , default is 10MiB
 */
export const EDIT_FILE_SIZE_LIMIT = 10 * 1024 * 1024;

export enum ViewMode {
  Default,
  Album,
  Details,
}

/**
 * Use it via ConfigContext & useConfig.
 * The context's value get assigned in `<App />`.
 */
export interface Config {
  auth: string;
  viewMode: ViewMode;
  sort: Sort;
  editorPrompt: number;
  editorReadOnly: number;
  fullControl: boolean;
  /**
   * private file url default expires unix timestamp (miniseconds)
   */
  expires: number;
  /**
   * auth info from search params: scope, expires, token
   */
  authSearchParams: URLSearchParams | null;
  /**
   * Effective auth credendials that can be used in transfer APIs
   */
  effectiveAuth: string;
  setAuth: React.Dispatch<React.SetStateAction<string>>;
  setViewMode: React.Dispatch<React.SetStateAction<number>>;
  setSort: React.Dispatch<React.SetStateAction<number>>;
  setEditorPrompt: React.Dispatch<React.SetStateAction<number>>;
  setEditorReadOnly: React.Dispatch<React.SetStateAction<number>>;
}

export interface FileItem {
  /**
   * system (special) folder
   */
  system?: boolean;
  /**
   * Alternative display name for system folder
   */
  name?: string;
  /**
   * Icon for system folder
   */
  icon?: React.FunctionComponent<any>;

  key: string;
  size: number;
  uploaded: Date;
  httpMetadata: { contentType: string };
  customMetadata?: { thumbnail?: string; url?: string };
  checksums: {
    md5?: string;
    sha1?: string;
    sha256?: string;
  };
}

export interface ViewProps {
  isSearch: boolean;
  auth: string | null;
  files: FileItem[];
  onClick: (file: FileItem) => void;
  onContextMenu: (file: FileItem) => void;
  multiSelected: string[];
  emptyMessage?: React.ReactNode;
}

export interface FileViewerProps {
  filekey: string;
  open: boolean;
  close: () => void;
  setError: React.Dispatch<React.SetStateAction<any>>;
}

export function isThumbnailPossible(file: FileItem) {
  const ct = file.httpMetadata?.contentType;
  return ct && (ct.startsWith("image/") || ct === "video/mp4" || ct === "application/pdf");
}

export function isTextual(file: FileItem): boolean {
  const [mime] = mimeType(file.httpMetadata.contentType);
  if (!mime || mime === MIME_DEFAULT) {
    return file.size <= 1024 * 1024;
  }
  return mime.startsWith("text/") || TXT_MIMES.includes(mime);
}

export function downloadFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.click();
}

export const PreventDefaultEventCb: React.EventHandler<SyntheticEvent> = function (e) {
  e.preventDefault();
};

export const SHARES_FOLDER_KEY = ".shares";

/**
 * Generate a cryptographically strong password of format /[a-zA-Z0-9]{length}/
 * @param digitOnly bool. If true, output will be comprised of digit chars ([0-9]) only.
 */
export function generatePassword(length: number, digitOnly?: boolean) {
  if (length <= 0) {
    return "";
  }

  const PWD_CHARS = digitOnly ? "0123456789" : "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const PWD_CHARS_LEN = PWD_CHARS.length;

  // To avoid modulo bias, we only use random numbers that are less than
  // the largest multiple of PWD_CHARS_LEN that fits in the range of a Uint16 value [0, 65535].
  // (0xFFFF + 1) is the total number of possible Uint16 values (65536).
  const MAX_VALID_THRESHOLD = Math.floor((0xffff + 1) / PWD_CHARS_LEN) * PWD_CHARS_LEN;

  let password = "";
  // Buffer for random values to reduce calls to crypto.getRandomValues.
  // A size of length * 2 is a heuristic, generally sufficient for typical password lengths.
  const randomValuesBuffer = new Uint16Array(length * 2);
  let bufferIndex = randomValuesBuffer.length; // Start as if the buffer is exhausted

  while (password.length < length) {
    if (bufferIndex >= randomValuesBuffer.length) {
      crypto.getRandomValues(randomValuesBuffer);
      bufferIndex = 0;
    }

    const randomValue = randomValuesBuffer[bufferIndex++];
    if (randomValue < MAX_VALID_THRESHOLD) {
      password += PWD_CHARS[randomValue % PWD_CHARS_LEN];
    }
  }
  return password;
}

export const ConfigContext = React.createContext<Config | null>(null);

export const SystemConfigContext = React.createContext<PublicSystemConfig | null>(null);

/**
 * ConfigContext's value get assigned in `<App />` to here it is assumed to be not null.
 */
export const useConfig = () => React.useContext<Config | null>(ConfigContext)!;

/**
 * SystemConfigContext's value get assigned in `<App />` to here it is assumed to be not null.
 */
export const useSystemConfig = () => React.useContext<PublicSystemConfig | null>(SystemConfigContext)!;

/**
 * Get permission of a dir / file key, along with matched prefix if any.
 */
export function getFilePermission(
  key: string,
  systemConfig: PublicSystemConfig
): [permission: Permission, prefix: string] {
  for (const prefix of systemConfig.publicPrefix) {
    if (key === prefix || key.startsWith(prefix + "/")) {
      return [Permission.OpenFile, prefix];
    }
  }
  for (const prefix of systemConfig.publicDirPrefix) {
    if (key === prefix || key.startsWith(prefix + "/")) {
      return [Permission.OpenDir, prefix];
    }
  }
  for (const prefix of systemConfig.publicRwdirPrefix) {
    if (key === prefix || key.startsWith(prefix + "/")) {
      return [Permission.OpenRwDir, prefix];
    }
  }
  return [Permission.RequireAuth, ""];
}

export function dataUrltoBlob(dataUrl: string): Blob {
  const [meta, data] = dataUrl.split(",");

  // Convert the base64 encoded data to a binary string.
  const byteString = atob(data);

  // Get the MIME type.
  const [mimeTypeWithDataPrefix] = meta.split(";");
  const mimeType = mimeTypeWithDataPrefix.replace("data:", "");

  // Convert the binary string to an ArrayBuffer.
  const arrayBuffer = Uint8Array.from(byteString, (c) => c.charCodeAt(0)).buffer;

  // Create a blob from the ArrayBuffer.
  return new Blob([arrayBuffer], { type: mimeType });
}

export enum Sort {
  Default,
  ByDate,
  BySize,
}

/**
 * Sort labels. index as value.
 */
export const sortLabels = ["Default sort", "Sort by date", "Sort by size"] as const;

export interface SearchOptions {
  baseDir?: string;
  /**
   * Full search, not limited to file name prefix.
   */
  full?: boolean;
}

export function search2Cwd(keyword: string, options: SearchOptions = {}): string {
  let cwd = options.baseDir || "";
  if (cwd) {
    cwd += "/";
  }
  cwd += KEY_PART_SEARCH;
  if (options.full) {
    cwd += "/" + KEY_PART_SEARCH_FULL;
  }
  if (keyword) {
    cwd += "/" + encodeURIComponent(keyword);
  }
  return cwd;
}

// The reverse of "search2Cwd" function
export function cwd2Search(cwd: string): [isSearch: boolean, keyword: string, options: SearchOptions] {
  const parts = cwd.split("/");
  const index = parts.indexOf(KEY_PART_SEARCH); // Consider using a constant for KEY_PART_SEARCH
  if (index == -1) {
    return [false, "", {}];
  }
  const searchBaseDir = parts.slice(0, index).join("/");
  let searchKeyword: string;
  let full: boolean;
  if (parts.length > index + 2) {
    searchKeyword = decodeURIComponent(parts[index + 2] || "");
    full = parts[index + 1] === KEY_PART_SEARCH_FULL;
  } else if (parts[index + 1] === KEY_PART_SEARCH_FULL) {
    searchKeyword = "";
    full = true;
  } else {
    searchKeyword = decodeURIComponent(parts[index + 1] || "");
    full = false;
  }
  return [true, searchKeyword, { baseDir: searchBaseDir, full }];
}

/**
 * Return sanitized html of a text Response (text/plain or text/markdown)
 * @param res
 */
export async function response2Html(res: Response): Promise<string> {
  const [mime] = mimeType(res.headers.get("Content-Type"));
  if (mime === MIME_MARKDOWN) {
    const text = await res.text();
    const htmlOutput = await marked.parse(text);
    const sanitizedHtml = sanitizeHtml(htmlOutput);
    return sanitizedHtml;
  } else if (mime === MIME_TXT) {
    let text = await res.text();
    // Simple text to HTML conversion, escaping HTML entities
    // Also, recognize "http(s)://..." urls and convert them to <a> links
    text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    text = text.replace(/https?:\/\/[^\s]+/g, (url) => `<a href="${url}" rel="noopener noreferrer">${url}</a>`);
    text = sanitizeHtml(text);
    return text;
  }
  throw new Error("Unsupported response type for conversion to HTML");
}
