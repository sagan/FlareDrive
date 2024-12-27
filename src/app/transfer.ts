import pLimit from "p-limit";
import mime from "mime";
import {
  key2Path,
  escapeRegExp,
  str2int,
  Permission,
  WEBDAV_ENDPOINT,
  HEADER_PERMISSION,
  HEADER_AUTHED,
  HEADER_INAPP,
  HEADER_AUTH,
  HEADER_FD_THUMBNAIL,
  KEY_PREFIX_THUMBNAIL,
  MIME_XML,
  THUMBNAIL_SIZE,
  sha256,
  THUMBNAIL_API,
  HEADER_AUTHORIZATION,
  HEADER_CONTENT_TYPE,
  THUMBNAIL_VARIABLE,
  ThumbnailObject,
  HEADER_SOURCE_URL,
} from "../../lib/commons";
import { FileItem } from "../commons";
import { TransferTask } from "./transferQueue";

/**
 * Client side canvas generated thumbnail blob content type.
 */
const CLIENT_THUMBNAIL_TYPE = "image/png";

export async function fetchPath(
  path: string,
  auth?: string | null
): Promise<{
  permission: Permission;
  authed: boolean;
  auth: string | null;
  items: FileItem[] | null;
}> {
  const res = await fetch(`${WEBDAV_ENDPOINT}${key2Path(path)}`, {
    method: "PROPFIND",
    headers: {
      Depth: "1",
      [HEADER_INAPP]: "1",
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
    },
  });

  if (!res.ok) {
    if (res.status == 404) {
      return {
        authed: !!str2int(res.headers.get(HEADER_AUTHED)),
        auth: res.headers.get(HEADER_AUTH),
        items: null,
        permission: Permission.RequireAuth,
      };
    }
    throw new Error(`Failed to fetch: status=${res.status}`);
  }
  const contentType = res.headers.get(HEADER_CONTENT_TYPE) || "";
  if (contentType !== MIME_XML && !contentType.startsWith(MIME_XML + ";")) {
    throw new Error("Invalid response");
  }

  auth = res.headers.get(HEADER_AUTH);
  const authed = !!str2int(res.headers.get(HEADER_AUTHED));
  const permission: Permission = str2int(res.headers.get(HEADER_PERMISSION), Permission.RequireAuth);
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
      return {
        key: decodeURI(href).replace(new RegExp("^" + escapeRegExp(WEBDAV_ENDPOINT)), ""),
        size: size ? Number(size) : 0,
        uploaded: lastModified!,
        httpMetadata: { contentType: contentType! },
        customMetadata: { thumbnail },
      } as FileItem;
    });
  return { permission, authed, auth, items };
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
    const pdfjsLib = await import(
      // @ts-ignore
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs"
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
    const pdf = await pdfjsLib.getDocument(url).promise;
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
  url: RequestInfo | URL,
  requestInit: RequestInit & {
    onUploadProgress?: (progressEvent: ProgressEvent) => void;
  }
) {
  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = requestInit.onUploadProgress ?? null;
    xhr.open(requestInit.method ?? "GET", url instanceof Request ? url.url : url);
    const headers = new Headers(requestInit.headers);
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
    xhr.onerror = reject;
    if (requestInit.body instanceof Blob || typeof requestInit.body === "string") {
      xhr.send(requestInit.body);
    }
  });
}

export async function multipartUpload(
  key: string,
  file: File,
  options?: {
    headers?: Record<string, string>;
    onUploadProgress?: (progressEvent: { loaded: number; total: number }) => void;
  }
) {
  const headers = options?.headers || {};
  headers["content-type"] = file.type;

  const uploadResponse = await fetch(`${WEBDAV_ENDPOINT}${key2Path(key)}?uploads`, {
    headers,
    method: "POST",
  });
  const { uploadId } = await uploadResponse.json<{ uploadId: string }>();
  const totalChunks = Math.ceil(file.size / SIZE_LIMIT);

  const limit = pLimit(2);
  const parts = Array.from({ length: totalChunks }, (_, i) => i + 1);
  const partsLoaded = Array.from({ length: totalChunks + 1 }, () => 0);
  const promises = parts.map((i) =>
    limit(async () => {
      const chunk = file.slice((i - 1) * SIZE_LIMIT, i * SIZE_LIMIT);
      const searchParams = new URLSearchParams({
        partNumber: i.toString(),
        uploadId,
      });
      const uploadUrl = `${WEBDAV_ENDPOINT}${key2Path(key)}?${searchParams}`;
      if (i === limit.concurrency) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const uploadPart = () =>
        xhrFetch(uploadUrl, {
          method: "PUT",
          headers,
          body: chunk,
          onUploadProgress: (progressEvent) => {
            partsLoaded[i] = progressEvent.loaded;
            options?.onUploadProgress?.({
              loaded: partsLoaded.reduce((a, b) => a + b),
              total: file.size,
            });
          },
        });

      const retryReducer = (acc: Promise<Response>) =>
        acc
          .then((res) => {
            const retryAfter = res.headers.get("retry-after");
            if (!retryAfter) return res;
            return uploadPart();
          })
          .catch(uploadPart);
      const response = await [1, 2].reduce(retryReducer, uploadPart());
      return { partNumber: i, etag: response.headers.get("etag")! };
    })
  );
  const uploadedParts = await Promise.all(promises);
  const completeParams = new URLSearchParams({ uploadId });
  const response = await fetch(`${WEBDAV_ENDPOINT}${key2Path(key)}?${completeParams}`, {
    method: "POST",
    headers: {
      ...(headers[HEADER_AUTHORIZATION] ? { [HEADER_AUTHORIZATION]: headers[HEADER_AUTHORIZATION] } : {}),
    },
    body: JSON.stringify({ parts: uploadedParts }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response;
}

export async function copyPaste(source: string, target: string, auth: string | null, move = false) {
  const uploadUrl = `${WEBDAV_ENDPOINT}${key2Path(source)}`;
  const destinationUrl = new URL(`${WEBDAV_ENDPOINT}${key2Path(target)}`, window.location.href);
  await fetch(uploadUrl, {
    method: move ? "MOVE" : "COPY",
    headers: {
      Destination: destinationUrl.href,
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
    },
  });
}

export async function createFolder(cwd: string, auth: string | null) {
  try {
    const folderName = window.prompt("Folder name");
    if (!folderName) return;
    if (folderName.includes("/")) {
      window.alert("Invalid folder name");
      return;
    }
    const folderKey = (cwd ? cwd + "/" : "") + folderName;
    const uploadUrl = `${WEBDAV_ENDPOINT}${key2Path(folderKey)}`;
    await fetch(uploadUrl, {
      method: "MKCOL",
      headers: {
        ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
      },
    });
  } catch (error) {
    console.log(`Create folder failed`);
  }
}

export async function processTransferTask({
  auth,
  task,
  onTaskProgress,
}: {
  auth: string | null;
  task: TransferTask;
  onTaskProgress?: (event: { loaded: number; total: number }) => void;
}) {
  const { remoteKey, file } = task;
  if (task.type !== "upload" || !file) {
    throw new Error("Invalid task");
  }
  let thumbnailDigest = null;
  console.log("upload", task);
  if (file.type.startsWith("image/") || file.type === "video/mp4" || file.type === "application/pdf") {
    try {
      const thumbnailBlob = await generateThumbnailFromFile(file);
      const digestHex = await sha256(thumbnailBlob);

      const thumbnailUploadUrl = `${WEBDAV_ENDPOINT}${KEY_PREFIX_THUMBNAIL}${digestHex}`;
      try {
        await fetch(thumbnailUploadUrl, {
          method: "PUT",
          body: thumbnailBlob,
          headers: {
            [HEADER_CONTENT_TYPE]: CLIENT_THUMBNAIL_TYPE,
            ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
          },
        });
        thumbnailDigest = digestHex;
      } catch (error) {
        console.log(`Upload ${digestHex}.png failed`);
      }
    } catch (error) {
      console.log(`Generate thumbnail failed`);
    }
  }

  const headers: Record<string, string> = {
    ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
    ...(thumbnailDigest ? { [HEADER_FD_THUMBNAIL]: thumbnailDigest } : {}),
  };
  if (file.size >= SIZE_LIMIT) {
    return await multipartUpload(remoteKey, file, {
      headers,
      onUploadProgress: onTaskProgress,
    });
  } else {
    const uploadUrl = `${WEBDAV_ENDPOINT}${key2Path(remoteKey)}`;
    return await xhrFetch(uploadUrl, {
      method: "PUT",
      headers,
      body: file,
      onUploadProgress: onTaskProgress,
    });
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
}: {
  key: string;
  sourceUrl: string;
  auth: string | null;
  contentType?: string;
  signal?: AbortSignal;
}): Promise<FileItem> {
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
  const obj = await res.json<R2Object>();
  return {
    key: obj.key,
    size: obj.size,
    uploaded: (obj as any).uploaded,
    httpMetadata: {
      contentType: obj.httpMetadata?.contentType || "",
    },
    customMetadata: obj.customMetadata,
  };
}
