import { SyntheticEvent } from "react";
import { MIME_DEFAULT, MIME_DIR, Permission, TXT_MIMES, mimeType, trimPrefixSuffix } from "../lib/commons";
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

export function isDirectory(file: FileItem) {
  return file.httpMetadata?.contentType === MIME_DIR;
}

export function isThumbnailPossible(file: FileItem) {
  const ct = file.httpMetadata?.contentType;
  return ct && (ct.startsWith("image/") || ct === "video/mp4" || ct === "application/pdf");
}

export function isImage(file: FileItem): boolean {
  return file.httpMetadata.contentType.startsWith("image/");
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
  let chars = digitOnly ? "0123456789" : "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let password = "";
  let max = Math.floor(65535 / chars.length) * chars.length;
  const array = new Uint16Array(length * 2);
  main: while (true) {
    crypto.getRandomValues(array);
    for (let i = 0; i < array.length; i++) {
      // By taking only the numbers up to a multiple of char space size and discarding others,
      // we expect a uniform distribution of all possible chars.
      if (array[i] < max) {
        password += chars[array[i] % chars.length];
      }
      if (password.length >= length) {
        break main;
      }
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
 * Get permission of a dir / file key.
 */
export function getFilePermission(key: string): Permission {
  if (window.__PUBLIC_PREFIX__.some((prefix) => key === prefix || key.startsWith(prefix + "/"))) {
    return Permission.OpenFile;
  }
  if (window.__PUBLIC_DIR_PREFIX__.some((prefix) => key === prefix || key.startsWith(prefix + "/"))) {
    return Permission.OpenDir;
  }
  return Permission.RequireAuth;
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
