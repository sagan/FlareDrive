import { Mime } from "mime";
import standardTypes from "mime/types/standard.js";
import otherTypes from "mime/types/other.js";
import { parse as parseIni } from "ini";
import {
  EXT_URL,
  EXT_WEBLOC,
  MIME_CAT_AUDIO_PREFIX,
  MIME_CAT_IMAGE_PREFIX,
  MIME_CAT_TEXT_PREFIX,
  MIME_DEFAULT,
  MIME_DIR,
  MIME_MP4,
  MIME_PDF,
  MIME_URL,
  TXT_MIMES,
  R2ObjectAlike,
  extname,
  mimeType,
} from "./commons";

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

export function isTextual(object: R2ObjectAlike): boolean {
  const [mime] = mimeType(fileMime(object));
  if (!mime || mime === MIME_DEFAULT) {
    return object.size <= 1024 * 1024;
  }
  return mime.startsWith(MIME_CAT_TEXT_PREFIX) || (TXT_MIMES as readonly string[]).includes(mime);
}

export function isThumbnailPossible(file: R2ObjectAlike) {
  const ct = fileMime(file);
  return ct && (ct.startsWith(MIME_CAT_IMAGE_PREFIX) || ct === MIME_MP4 || ct === MIME_PDF);
}

/**
 * Return whether the R2Object is a image file
 */
export function isImage(object: R2ObjectAlike): boolean {
  return fileMime(object).startsWith(MIME_CAT_IMAGE_PREFIX);
}

/**
 * Return whether the R2Object is a audio file
 */
export function isAudio(object: R2ObjectAlike): boolean {
  return fileMime(object).startsWith(MIME_CAT_AUDIO_PREFIX);
}

/**
 * Return whether an R2Object or alike is a dir
 */
export function isDirectory(object: R2ObjectAlike): boolean {
  return (object.size === 0 && object.key.endsWith("/")) || fileMime(object) === MIME_DIR;
}

/**
 * Return whether an R2Object or alike is a url (internet shortcut) file
 */
export function isUrlFile(object: R2ObjectAlike): boolean {
  return fileMime(object) === MIME_URL && (!!object.customMetadata?.url || object.size === 0);
}

export function fileMime(object: R2ObjectAlike): string {
  return object.httpMetadata?.contentType || mime.getType(object.key) || "";
}
