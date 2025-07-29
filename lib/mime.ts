import { Mime } from "mime";
import standardTypes from "mime/types/standard.js";
import otherTypes from "mime/types/other.js";
import { parse as parseIni } from "ini";
import { EXT_URL, EXT_WEBLOC, MIME_URL, extname } from "./commons";

const mime = new Mime(standardTypes, otherTypes);

mime.define({ [MIME_URL]: [EXT_URL.slice(1), EXT_WEBLOC.slice(1)] });

export default mime;

/**
 * Parse contents of a Windows .url file and return parsed url.
 */
export function parseUrlFile(contents: string, filename = ""): string {
  const ext = extname(filename);
  if (!ext || ext == EXT_URL) {
    const parsedData = parseIni(contents);
    return parsedData.InternetShortcut?.URL || "";
  } else if (ext == EXT_WEBLOC) {
    const match = contents.match(/<key>URL<\/key>\s*<string>(.*?)<\/string>/);
    return match ? match[1] : "";
  }
  return "";
}

/**
 * Generate contents of "url" file from a url.
 * If filename has ".webloc" extension, generate Mac OS ".webloc" file contents;
 * If filename has ".url" extension or is empty, generate Windows ".url" file contents.
 * Otherwise return empty string.
 */
export function generateUrlFile(url: string, filename = ""): string {
  const ext = extname(filename);
  if (!ext || ext == EXT_URL) {
    return `[InternetShortcut]
IDList=
URL=${url}
`;
  } else if (ext == EXT_WEBLOC) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>${url}</string>
</dict>
</plist>
`;
  }
  return "";
}
