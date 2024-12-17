import { trimPrefixSuffix } from "../lib/commons";
import { SyntheticEvent } from "react";

export const PreventDefaultEventCb: React.EventHandler<SyntheticEvent> = function (e) {
  e.preventDefault();
};

export const LOCAL_STORAGE_KEY_AUTH = "auth";

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
