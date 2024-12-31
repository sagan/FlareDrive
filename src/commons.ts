import { SyntheticEvent } from "react";
import { MIME_DIR, TXT_MIMES, mimeType } from "../lib/commons";

export const VIEWMODE_VARIABLE = "viewMode";

export const EDITOR_PROMPT_VARIABLE = "editorPrompt";

/**
 * Edit file size limiit , default is 10MiB
 */
export const EDIT_FILE_SIZE_LIMIT = 10 * 1024 * 1024;

export enum ViewMode {
  Default,
  Album,
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
  uploaded: string;
  httpMetadata: { contentType: string };
  customMetadata?: { thumbnail?: string };
}

export interface ViewProps {
  auth: string | null;
  files: FileItem[];
  onClick: (file: FileItem) => void;
  onContextMenu: (file: FileItem) => void;
  multiSelected: string[];
  emptyMessage?: React.ReactNode;
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

export function isTextFile(file: FileItem): boolean {
  const [mime] = mimeType(file.httpMetadata.contentType);
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
 */
export function generatePassword(length: number) {
  if (length <= 0) {
    return "";
  }
  let chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
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
