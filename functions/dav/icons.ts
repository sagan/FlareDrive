import mime from "mime";
import {
  HEADER_CONTENT_TYPE,
  HEADER_ETAG,
  MIME_DIR,
  MIME_GZIP,
  MIME_JSON,
  MIME_PDF,
  MIME_SH,
  MIME_XML,
  MIME_ZIP,
  cut,
  extname,
} from "../../lib/commons";

const SVG_HEADER = `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">`;

const ICON_PDF = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" aria-hidden="true" viewBox="0 0 24 24" data-testid="PictureAsPdfIcon"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5zm4-3H19v1h1.5V11H19v2h-1.5V7h3zM9 9.5h1v-1H9zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4zm10 5.5h1v-3h-1z"></path></svg>`;

const ICON_IMAGE = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" aria-hidden="true" viewBox="0 0 24 24" data-testid="ImageIcon"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2M8.5 13.5l2.5 3.01L14.5 12l4.5 6H5z"></path></svg>`;

const ICON_VIDEO = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" aria-hidden="true" viewBox="0 0 24 24" data-testid="VideoFileIcon"><path d="M14 2H6.01c-1.1 0-2 .89-2 2L4 20c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8zm-1 7V3.5L18.5 9zm1 5 2-1.06v4.12L14 16v1c0 .55-.45 1-1 1H9c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h4c.55 0 1 .45 1 1z"></path></svg>`;

const ICON_TEXT = `<svg  version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" aria-hidden="true" viewBox="0 0 24 24" data-testid="CodeIcon"><path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6z"></path></svg>`;

const ICON_AUDIO = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" aria-hidden="true" viewBox="0 0 24 24" data-testid="AudioFileIcon"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8zm2 11h-3v3.75c0 1.24-1.01 2.25-2.25 2.25S8.5 17.99 8.5 16.75s1.01-2.25 2.25-2.25c.46 0 .89.14 1.25.38V11h4zm-3-4V3.5L18.5 9z"></path></svg>`;

const ICON_ZIP = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" aria-hidden="true" viewBox="0 0 24 24" data-testid="InsertDriveFileOutlinedIcon"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8zM6 20V4h7v5h5v11z"></path></svg>`;

const ICON_DIR = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" aria-hidden="true" viewBox="0 0 24 24" data-testid="FolderIcon"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8z"></path></svg>`;

const DEFAULT_ICON = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" aria-hidden="true" viewBox="0 0 24 24" data-testid="AttachmentIcon"><path d="M2 12.5C2 9.46 4.46 7 7.5 7H18c2.21 0 4 1.79 4 4s-1.79 4-4 4H9.5C8.12 15 7 13.88 7 12.5S8.12 10 9.5 10H17v2H9.41c-.55 0-.55 1 0 1H18c1.1 0 2-.9 2-2s-.9-2-2-2H7.5C5.57 9 4 10.57 4 12.5S5.57 16 7.5 16H17v2H7.5C4.46 18 2 15.54 2 12.5"></path></svg>`;

/**
 * MIME icons.
 * key: MIME (e.g. "text/plain"), MIME category (e.g. "text"), or extension (e.g. ".txt").
 * an empty string key exists as fallback.
 * value: [svg_content, etag].
 */
const icons: Record<string, [string, string]> = {
  image: [ICON_IMAGE, "image_icon"],
  video: [ICON_VIDEO, "video_icon"],
  audio: [ICON_AUDIO, "audio_icon"],
  text: [ICON_TEXT, "text_icon"],
  [MIME_SH]: [ICON_TEXT, "text_icon"],
  [MIME_JSON]: [ICON_TEXT, "text_icon"],
  [MIME_XML]: [ICON_TEXT, "text_icon"],
  [MIME_PDF]: [ICON_PDF, "pdf_icon"],
  [MIME_ZIP]: [ICON_ZIP, "zip_icon"],
  [MIME_GZIP]: [ICON_ZIP, "zip_icon"],
  [MIME_DIR]: [ICON_DIR, "dir_icon"],
  "": [DEFAULT_ICON, "file_icon"],
};

export function fallbackIconResponse(
  path: string,
  contentType?: string | null,
  color = "",
  sendHttp200 = false
): Response {
  const fileExt = extname(path).toLowerCase();
  if (!contentType) {
    contentType = mime.getType(fileExt) || "";
  }
  const [contentTypeCat] = cut(contentType, "/");
  const icon = icons[contentType] || icons[contentTypeCat] || icons[fileExt] || icons[""];
  let iconContent = icon[0];
  if (color) {
    iconContent = `<svg fill="${color}"` + iconContent.slice(4);
  }
  return new Response(SVG_HEADER + iconContent, {
    status: sendHttp200 ? 200 : 404,
    headers: {
      [HEADER_ETAG]: `"${icon[1]}"`,
      [HEADER_CONTENT_TYPE]: "image/svg+xml",
    },
  });
}
