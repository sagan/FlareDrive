import { SyntheticEvent } from "react";
import { MIME_DEFAULT, MIME_DIR, Permission, TXT_MIMES, mimeType } from "../lib/commons";
import React from "react";

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
  icon?: React.FunctionComponent;

  key: string;
  size: number;
  uploaded: Date;
  httpMetadata: { contentType: string };
  customMetadata?: { thumbnail?: string };
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

/**
 * ConfigContext's value get assigned in `<App />` to here it is assumed to be not null.
 */
export const useConfig = () => React.useContext<Config | null>(ConfigContext)!;

/**
 * Get permission of a dir / file key, along with matched prefix if any.
 */
export function getFilePermission(key: string): [permission: Permission, prefix: string] {
  for (const prefix of window.__PUBLIC_PREFIX__) {
    if (key === prefix || key.startsWith(prefix + "/")) {
      return [Permission.OpenFile, prefix];
    }
  }
  for (const prefix of window.__PUBLIC_DIR_PREFIX__) {
    if (key === prefix || key.startsWith(prefix + "/")) {
      return [Permission.OpenDir, prefix];
    }
  }
  for (const prefix of window.__PUBLIC_RWDIR_PREFIX__) {
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
