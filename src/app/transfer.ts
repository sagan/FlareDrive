import pLimit from "p-limit";
import mime from "mime";
import { pdfjs } from "react-pdf";
import {
  WEBDAV_ENDPOINT,
  HEADER_AUTHED,
  HEADER_INAPP,
  HEADER_AUTH,
  HEADER_FD_THUMBNAIL,
  KEY_PREFIX_THUMBNAIL,
  MIME_XML,
  THUMBNAIL_SIZE,
  THUMBNAIL_API,
  HEADER_AUTHORIZATION,
  HEADER_CONTENT_TYPE,
  THUMBNAIL_VARIABLE,
  HEADER_SOURCE_URL,
  HEADER_SOURCE_ASYNC,
  MIME_DEFAULT,
  HEADER_IF_UNMODIFIED_SINCE,
  HEADER_CONTENT_LENGTH,
  PART_NUMBER_VARIABLE,
  UPLOAD_ID_VARIABLE,
  HEADER_ETAG,
  HEADER_RETRY_AFTER,
  HEADER_DESTINATION,
  appendQueryStringToUrl,
  isBasicAuthHeader,
  ThumbnailObject,
  sha256,
  key2Path,
  escapeRegExp,
  str2int,
  cut,
} from "../../lib/commons";
import { FileItem } from "../commons";
import { TransferTask } from "./transferQueue";

/**
 * Client side canvas generated thumbnail blob content type.
 */
const CLIENT_THUMBNAIL_TYPE = "image/png";

function applyAuth(req: Request, auth: string): Request {
  if (auth) {
    const isBasicAuth = isBasicAuthHeader(auth);
    if (isBasicAuth) {
      req.headers.set(HEADER_AUTHORIZATION, auth);
    } else {
      req = new Request(appendQueryStringToUrl(req.url, auth), req);
    }
  }
  return req;
}

export async function fetchPath(
  path: string,
  auth: string
): Promise<{
  authed: boolean;
  auth: string;
  items: FileItem[] | null;
}> {
  const req = applyAuth(
    new Request(`${WEBDAV_ENDPOINT}${key2Path(path)}`, {
      method: "PROPFIND",
      headers: {
        Depth: "1",
        [HEADER_INAPP]: "1",
      },
    }),
    auth
  );
  const res = await fetch(req);

  if (!res.ok) {
    if (res.status == 404) {
      return {
        authed: !!str2int(res.headers.get(HEADER_AUTHED)),
        auth: res.headers.get(HEADER_AUTH) || "",
        items: null,
      };
    }
    throw new Error(`Failed to fetch: status=${res.status}`);
  }
  const contentType = res.headers.get(HEADER_CONTENT_TYPE) || "";
  if (contentType !== MIME_XML && !contentType.startsWith(MIME_XML + ";")) {
    throw new Error("Invalid response");
  }

  auth = res.headers.get(HEADER_AUTH) || "";
  const authed = !!str2int(res.headers.get(HEADER_AUTHED));
  const parser = new DOMParser();
  const text = await res.text();
  const document = parser.parseFromString(text, MIME_XML);
  const items: FileItem[] = Array.from(document.querySelectorAll("response"))
    .filter(
      (response) =>
        decodeURIComponent(response.querySelector("href")?.textContent ?? "").slice(WEBDAV_ENDPOINT.length) !==
        path.replace(/\/$/, "")
    )
    .map((response) => {
      const href = response.querySelector("href")?.textContent;
      if (!href) {
        throw new Error("Invalid response");
      }
      const contentType = response.querySelector("getcontenttype")?.textContent;
      const size = response.querySelector("getcontentlength")?.textContent;
      const lastModified = response.querySelector("getlastmodified")?.textContent;
      const thumbnail = response.getElementsByTagNameNS("flaredrive", "thumbnail")[0]?.textContent;
      const checksums = response.getElementsByTagName("oc:checksum")[0]?.textContent || "";

      return {
        key: decodeURI(href).replace(new RegExp("^" + escapeRegExp(WEBDAV_ENDPOINT)), ""),
        size: size ? Number(size) : 0,
        uploaded: new Date(lastModified || 0),
        httpMetadata: { contentType: contentType || "" },
        customMetadata: { thumbnail },
        checksums: checksums
          .split(" ")
          .filter((a) => a)
          .reduce<FileItem["checksums"]>((pv, v) => {
            const [hash, value] = cut(v, ":");
            switch (hash.toLowerCase()) {
              case "md5":
                pv.md5 = value;
                break;
              case "sha1":
                pv.sha1 = value;
                break;
              case "sha256":
                pv.sha256 = value;
                break;
            }
            return pv;
          }, {}),
      } as FileItem;
    });
  return { authed, auth, items };
}

export async function generateThumbnailFromFile(file: File): Promise<Blob> {
  return generateThumbnailFromUrl(URL.createObjectURL(file), file.type);
}

export async function generateThumbnailFromUrl(url: string, contentType?: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  var ctx = canvas.getContext("2d")!;

  if (!contentType) {
    contentType = mime.getType(url) || "";
  }

  if (contentType.startsWith("image/")) {
    const image = await new Promise<HTMLImageElement>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.src = url;
    });
    ctx.drawImage(image, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  } else if (contentType === "video/mp4") {
    // Generate thumbnail from video
    const video = await new Promise<HTMLVideoElement>(async (resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true;
      video.src = url;
      setTimeout(() => reject(new Error("Video load timeout")), 2000);
      await video.play();
      video.pause();
      video.currentTime = 0;
      resolve(video);
    });
    ctx.drawImage(video, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  } else if (contentType === "application/pdf") {
    const pdf = await pdfjs.getDocument(url).promise;
    const page = await pdf.getPage(1);
    const { width, height } = page.getViewport({ scale: 1 });
    var scale = THUMBNAIL_SIZE / Math.max(width, height);
    const viewport = page.getViewport({ scale });
    const renderContext = { canvasContext: ctx, viewport };
    await page.render(renderContext).promise;
  } else {
    throw new Error(`unsupported file type: ${contentType}`);
  }

  const thumbnailBlob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject("canvas toBlob failed")), CLIENT_THUMBNAIL_TYPE)
  );

  return thumbnailBlob;
}

export const SIZE_LIMIT = 100 * 1000 * 1000; // 100MB

function xhrFetch(
  url: string,
  requestInit: RequestInit & {
    onUploadProgress?: (progressEvent: ProgressEvent) => void;
  },
  auth: string
) {
  return new Promise<Response>((resolve, reject) => {
    if (requestInit.signal?.aborted) {
      reject(requestInit.signal.reason);
      return;
    }
    const headers = new Headers(requestInit.headers);
    if (auth) {
      const isBasicAuth = isBasicAuthHeader(auth);
      if (isBasicAuth) {
        headers.set(HEADER_AUTHORIZATION, auth);
      } else {
        url = appendQueryStringToUrl(url, auth);
      }
    }
    const xhr = new XMLHttpRequest();
    if (requestInit.signal) {
      requestInit.signal.addEventListener("abort", () => xhr.abort());
    }
    xhr.upload.onprogress = requestInit.onUploadProgress ?? null;
    xhr.open(requestInit.method ?? "GET", url);
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.onload = () => {
      const headers = xhr
        .getAllResponseHeaders()
        .trim()
        .split("\r\n")
        .reduce((acc, header) => {
          const [key, value] = header.split(": ");
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);
      resolve(new Response(xhr.responseText, { status: xhr.status, headers }));
    };
    xhr.onabort = () => {
      reject(requestInit.signal?.reason);
    };
    xhr.onerror = reject;
    if (requestInit.body instanceof Blob || typeof requestInit.body === "string") {
      xhr.send(requestInit.body);
    }
  });
}

export async function multipartUpload(
  key: string,
  file: File,
  auth: string,
  signal: AbortSignal,
  options?: {
    headers?: Record<string, string>;
    onUploadProgress?: (progressEvent: { loaded: number; total: number }) => void;
  }
) {
  const headers = options?.headers || {};
  headers[HEADER_CONTENT_TYPE] = file.type;

  const uploadRequest = applyAuth(
    new Request(`${WEBDAV_ENDPOINT}${key2Path(key)}?uploads`, {
      headers,
      method: "POST",
      signal,
    }),
    auth
  );
  const uploadResponse = await fetch(uploadRequest);
  if (!uploadResponse.ok) {
    throw new Error(`multiform upload error: status=${uploadResponse.status}`);
  }
  const { uploadId } = await uploadResponse.json<{ uploadId: string }>();
  const totalChunks = Math.ceil(file.size / SIZE_LIMIT);

  const limit = pLimit(2);
  const parts = Array.from({ length: totalChunks }, (_, i) => i + 1);
  const partsLoaded = Array.from({ length: totalChunks + 1 }, () => 0);
  const promises = parts.map((i) => {
    return limit(async () => {
      const chunk = file.slice((i - 1) * SIZE_LIMIT, i * SIZE_LIMIT);
      const searchParams = new URLSearchParams({
        [PART_NUMBER_VARIABLE]: i.toString(),
        [UPLOAD_ID_VARIABLE]: uploadId,
      });
      const uploadUrl = `${WEBDAV_ENDPOINT}${key2Path(key)}?${searchParams}`;
      if (i === limit.concurrency) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const uploadPart = async () => {
        const res = await xhrFetch(
          uploadUrl,
          {
            method: "PUT",
            headers,
            body: chunk,
            signal,
            onUploadProgress: (progressEvent) => {
              partsLoaded[i] = progressEvent.loaded;
              options?.onUploadProgress?.({
                loaded: partsLoaded.reduce((a, b) => a + b),
                total: file.size,
              });
            },
          },
          auth
        );
        if (!res.ok) {
          throw new Error(`part upload error: status=${res.status}`);
        }
        return res;
      };

      const retryReducer = async (acc: Promise<Response>) => {
        try {
          const res = await acc;
          if (signal.aborted) {
            throw signal.reason;
          }
          const retryAfter = res.headers.get(HEADER_RETRY_AFTER);
          if (!retryAfter) {
            return res;
          }
          return uploadPart();
        } catch (e) {
          if (signal.aborted) {
            throw signal.reason;
          }
          return uploadPart();
        }
      };
      const res = await [1, 2].reduce(retryReducer, uploadPart());
      return { partNumber: i, etag: res.headers.get(HEADER_ETAG)! };
    });
  });
  const uploadedParts = await Promise.all(promises);
  const completeParams = new URLSearchParams({ uploadId });
  const req = applyAuth(
    new Request(`${WEBDAV_ENDPOINT}${key2Path(key)}?${completeParams}`, {
      method: "POST",
      body: JSON.stringify({ parts: uploadedParts }),
    }),
    auth
  );
  const res = await fetch(req);
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`status=${res.status}, msg=${msg}`);
  }
  return res;
}

export async function copyPaste(source: string, target: string, auth: string, move = false) {
  const uploadUrl = `${WEBDAV_ENDPOINT}${key2Path(source)}`;
  const destinationUrl = new URL(`${WEBDAV_ENDPOINT}${key2Path(target)}`, window.location.href);
  const req = applyAuth(
    new Request(uploadUrl, {
      method: move ? "MOVE" : "COPY",
      headers: {
        [HEADER_DESTINATION]: destinationUrl.href,
      },
    }),
    auth
  );
  const res = await fetch(req);
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
}

export async function createFolder(folderKey: string, auth: string) {
  const uploadUrl = `${WEBDAV_ENDPOINT}${key2Path(folderKey)}`;
  const req = applyAuth(new Request(uploadUrl, { method: "MKCOL" }), auth);
  const res = await fetch(req);
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
}

/**
 * Delete a file
 * @param key
 * @param auth
 */
export async function deleteFile(key: string, auth: string) {
  const req = applyAuth(new Request(`${WEBDAV_ENDPOINT}${key2Path(key)}`, { method: "DELETE" }), auth);
  const res = await fetch(req);
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
}

/**
 * Update / Create a file
 * @param key
 * @param auth
 * @returns
 */
export async function putFile({
  create,
  key,
  auth,
  body,
  contentType,
}: {
  key: string;
  auth: string;
  create?: boolean;
  body?: BodyInit;
  contentType?: string;
}) {
  const uploadUrl = `${WEBDAV_ENDPOINT}${key2Path(key)}`;
  const req = applyAuth(
    new Request(uploadUrl, {
      method: "PUT",
      headers: {
        [HEADER_CONTENT_TYPE]: contentType || mime.getType(key) || MIME_DEFAULT,
        ...(create ? { [HEADER_IF_UNMODIFIED_SINCE]: new Date(0).toUTCString() } : {}),
        ...(typeof body == "string" || (typeof body == "object" && "length" in body)
          ? {
              [HEADER_CONTENT_LENGTH]: `${body.length}`,
            }
          : {}),
      },
      body,
    }),
    auth
  );
  const res = await fetch(req);
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
}

export async function processTransferTask({
  auth,
  task,
  signal,
  onTaskProgress,
}: {
  auth: string;
  task: TransferTask;
  /**
   * abort signal
   */
  signal: AbortSignal;
  onTaskProgress?: (event: { loaded: number; total: number }) => void;
}) {
  const { remoteKey, file } = task;
  if (!file) {
    throw new Error("Invalid task");
  }
  let thumbnailDigest = "";
  console.log("upload", task);
  if (
    isBasicAuthHeader(auth) &&
    (file.type.startsWith("image/") || file.type === "video/mp4" || file.type === "application/pdf")
  ) {
    try {
      const thumbnailBlob = await generateThumbnailFromFile(file);
      const digestHex = await sha256(thumbnailBlob);

      const thumbnailUploadUrl = `${WEBDAV_ENDPOINT}${KEY_PREFIX_THUMBNAIL}${digestHex}`;
      try {
        const req = applyAuth(
          new Request(thumbnailUploadUrl, {
            method: "PUT",
            body: thumbnailBlob,
            headers: {
              [HEADER_CONTENT_TYPE]: CLIENT_THUMBNAIL_TYPE,
            },
            signal,
          }),
          auth
        );
        await fetch(req);
        thumbnailDigest = digestHex;
      } catch (err) {
        console.log(`Upload ${digestHex}.png failed`);
      }
    } catch (err) {
      console.log(`Generate thumbnail failed`);
    }
  }

  if (signal.aborted) {
    throw new Error(signal.reason);
  }

  const headers: Record<string, string> = {
    [HEADER_CONTENT_TYPE]: file.type,
    ...(thumbnailDigest ? { [HEADER_FD_THUMBNAIL]: thumbnailDigest } : {}),
  };
  if (file.size >= SIZE_LIMIT) {
    return await multipartUpload(remoteKey, file, auth, signal, {
      headers,
      onUploadProgress: onTaskProgress,
    });
  } else {
    const uploadUrl = `${WEBDAV_ENDPOINT}${key2Path(remoteKey)}`;
    const res = await xhrFetch(
      uploadUrl,
      {
        method: "PUT",
        headers,
        body: file,
        signal,
        onUploadProgress: onTaskProgress,
      },
      auth
    );
    if (!res.ok) {
      throw new Error(`Upload error: status=${res.status}`);
    }
    return res;
  }
}

/**
 * Server Side thumbnail generation
 * @param keys
 * @param auth
 * @param force
 */
export async function generateThumbnailsServerSide(
  keys: string[],
  auth: string | null,
  force: boolean
): Promise<Record<string, number>> {
  const res = await fetch(THUMBNAIL_API + (force ? "?force=1" : ""), {
    method: "POST",
    headers: {
      [HEADER_CONTENT_TYPE]: "application/json",
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
    },
    body: JSON.stringify({ keys }),
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  let result = await res.json<Record<string, number>>();
  return result;
}

/**
 * Update the thumbnail of a object.
 * @param key
 * @param blob
 * @param auth
 * @returns
 */
export async function putThumbnail(key: string, blob: Blob, auth: string | null): Promise<ThumbnailObject> {
  let res = await fetch(WEBDAV_ENDPOINT + key2Path(key) + `?${THUMBNAIL_VARIABLE}=1`, {
    method: "PUT",
    body: blob,
    headers: {
      [HEADER_CONTENT_TYPE]: CLIENT_THUMBNAIL_TYPE,
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  const thumbnailObj = await res.json<ThumbnailObject>();
  return thumbnailObj;
}

export async function uploadFromUrl({
  key,
  sourceUrl,
  contentType,
  auth,
  signal,
  asyncMode,
}: {
  key: string;
  sourceUrl: string;
  auth: string | null;
  contentType?: string;
  signal?: AbortSignal;
  asyncMode?: boolean;
}): Promise<FileItem | null> {
  const res = await fetch(`${WEBDAV_ENDPOINT}${key2Path(key)}`, {
    method: "PUT",
    headers: {
      [HEADER_SOURCE_URL]: sourceUrl,
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
      ...(contentType ? { [HEADER_CONTENT_TYPE]: contentType } : {}),
    },
    signal,
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`${res.status}: ${msg}`);
  }
  if (asyncMode) {
    return null;
  }
  const obj = await res.json<R2Object>();
  return {
    key: obj.key,
    size: obj.size,
    uploaded: new Date((obj as any).uploaded),
    httpMetadata: {
      contentType: obj.httpMetadata?.contentType || "",
      ...(asyncMode ? { [HEADER_SOURCE_ASYNC]: "1" } : {}),
    },
    customMetadata: obj.customMetadata,
    checksums: {},
  };
}
