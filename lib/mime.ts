import { Mime } from "mime";
import standardTypes from "mime/types/standard.js";
import otherTypes from "mime/types/other.js";
import { parse as parseIni } from "ini";
import { MIME_URL } from "./commons";

const mime = new Mime(standardTypes, otherTypes);

mime.define({ [MIME_URL]: ["url"] });

export default mime;

/**
 * Parse contents of a Windows .url file and return parsed url.
 */
export function parseUrlFile(contents: string): string {
  const parsedData = parseIni(contents);
  return parsedData.InternetShortcut?.URL || "";
}

/**
 * Generate contents of Windows .url file from a url
 */
export function generateUrlFile(url: string): string {
  return `[InternetShortcut]
IDList=
URL=${url}
`;
}
