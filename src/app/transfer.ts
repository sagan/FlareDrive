import pLimit from "p-limit";

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
} from "../../lib/commons";
import { FileItem } from "../FileGrid";
import { TransferTask } from "./transferQueue";

export async function fetchPath(path: string, auth?: string | null) {
  const res = await fetch(`${WEBDAV_ENDPOINT}${key2Path(path)}`, {
    method: "PROPFIND",
    headers: {
      Depth: "1",
      [HEADER_INAPP]: "1",
      ...(auth ? { Authorization: auth } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch: status=${res.status}`);
  }
  if (!res.headers.get("Content-Type")?.includes(MIME_XML)) {
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

const THUMBNAIL_SIZE = 144;

export async function generateThumbnail(file: File) {
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  var ctx = canvas.getContext("2d")!;

  if (file.type.startsWith("image/")) {
    const image = await new Promise<HTMLImageElement>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.src = URL.createObjectURL(file);
    });
    ctx.drawImage(image, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  } else if (file.type === "video/mp4") {
    // Generate thumbnail from video
    const video = await new Promise<HTMLVideoElement>(async (resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true;
      video.src = URL.createObjectURL(file);
      setTimeout(() => reject(new Error("Video load timeout")), 2000);
      await video.play();
      video.pause();
      video.currentTime = 0;
      resolve(video);
    });
    ctx.drawImage(video, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  } else if (file.type === "application/pdf") {
    const pdfjsLib = await import(
      // @ts-ignore
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs"
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    const page = await pdf.getPage(1);
    const { width, height } = page.getViewport({ scale: 1 });
    var scale = THUMBNAIL_SIZE / Math.max(width, height);
    const viewport = page.getViewport({ scale });
    const renderContext = { canvasContext: ctx, viewport };
    await page.render(renderContext).promise;
  }

  const thumbnailBlob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!)));

  return thumbnailBlob;
}

export async function blobDigest(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-1", await blob.arrayBuffer());
  const digestArray = Array.from(new Uint8Array(digest));
  const digestHex = digestArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return digestHex;
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
      ...(headers.Authorization ? { Authorization: headers.Authorization } : {}),
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
      ...(auth ? { Authorization: auth } : {}),
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
    const folderKey = `${cwd}${folderName}`;
    const uploadUrl = `${WEBDAV_ENDPOINT}${key2Path(folderKey)}`;
    await fetch(uploadUrl, {
      method: "MKCOL",
      headers: {
        ...(auth ? { Authorization: auth } : {}),
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
  if (task.type !== "upload" || !file) throw new Error("Invalid task");
  let thumbnailDigest = null;

  if (file.type.startsWith("image/") || file.type === "video/mp4" || file.type === "application/pdf") {
    try {
      const thumbnailBlob = await generateThumbnail(file);
      const digestHex = await blobDigest(thumbnailBlob);

      const thumbnailUploadUrl = `${WEBDAV_ENDPOINT}${KEY_PREFIX_THUMBNAIL}${digestHex}`;
      try {
        await fetch(thumbnailUploadUrl, {
          method: "PUT",
          body: thumbnailBlob,
          headers: {
            ...(auth ? { Authorization: auth } : {}),
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
    ...(auth ? { Authorization: auth } : {}),
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
