import mime, { parseUrlFile } from "../../lib/mime";
import {
  CLOUD_DOWNLOAD_SIZE_LIMIT,
  HEADER_CONTENT_LENGTH,
  HEADER_CONTENT_TYPE,
  HEADER_FD_THUMBNAIL,
  HEADER_SOURCE_ASYNC,
  HEADER_SOURCE_URL,
  HEADER_SOURCE_URL_OPTIONS,
  KEY_PREFIX_PRIVATE,
  KEY_PREFIX_THUMBNAIL,
  MIME_DEFAULT,
  PART_NUMBER_VARIABLE,
  THUMBNAIL_VARIABLE,
  UPLOAD_ID_VARIABLE,
  HEADER_NO_THUMBNAIL,
  MIME_URL,
  URL_VARIABLE,
  COMMENT_VARIABLE,
  HEADER_LOCATION,
  SCOPE_GLOBAL,
  ThumbnailObject,
  humanReadableSize,
  mimeType,
  sha256,
  str2int,
  dirname,
  isImage,
  validateAndGetSafeUrl,
  isDirectory,
  MD5_VARIABLE,
} from "../../lib/commons";
import {
  checkConflict,
  checkInvalidUserFileKey,
  generateFileThumbnail,
  jsonResponse,
  responseBadRequest,
  responseConflict,
  responseCreated,
  responseForbidden,
  responseInternalServerError,
  responseMethodNotAllowed,
  responseNoContent,
  responseNotFound,
  responseNotModified,
  responsePreconditionsFailed,
} from "../commons";
import { RequestHandlerParams, ROOT_OBJECT } from "./utils";
import { upsertDbFile } from "../db";

async function handleRequestPutMultipart({ bucket, path, request }: RequestHandlerParams) {
  const url = new URL(request.url);

  const uploadId = new URLSearchParams(url.search).get(UPLOAD_ID_VARIABLE);
  const partNumberStr = new URLSearchParams(url.search).get(PART_NUMBER_VARIABLE);
  if (!uploadId || !partNumberStr || !request.body) {
    return responseBadRequest();
  }
  const multipartUpload = bucket.resumeMultipartUpload(path, uploadId);

  const partNumber = parseInt(partNumberStr);
  const uploadedPart = await multipartUpload.uploadPart(partNumber, request.body);

  // 2025-06 test: CF ignore application-set ETag header, so put result in response body
  return new Response(JSON.stringify(uploadedPart), {
    headers: {
      [HEADER_CONTENT_TYPE]: "application/json",
      // [HEADER_ETAG]: uploadedPart.etag,
    },
  });
}

export async function handleRequestPut({ context, bucket, path, request, scope }: RequestHandlerParams) {
  const { env } = context;
  const invalidPathResponse = await checkInvalidUserFileKey(path);
  if (invalidPathResponse) {
    return invalidPathResponse;
  }
  const searchParams = new URLSearchParams(new URL(request.url).search);

  if (str2int(searchParams.get(THUMBNAIL_VARIABLE))) {
    // request is to update object's thumbnail.
    // return created thumbnail R2Object json when success.
    const object = await bucket.get(path);
    if (!object) {
      return responseNotFound();
    }
    if (checkConflict(request, object)) {
      return responseConflict();
    }

    const blob = await request.blob();
    const digest = await sha256(blob);
    if (digest === object.customMetadata?.thumbnail) {
      const currentThumbnailObj = await bucket.head(KEY_PREFIX_THUMBNAIL + digest);
      if (currentThumbnailObj) {
        return jsonResponse<ThumbnailObject>({ digest });
      }
    }
    await bucket.put(KEY_PREFIX_THUMBNAIL + digest, blob, {
      httpMetadata: request.headers,
    });
    if (object.customMetadata?.thumbnail !== digest) {
      const updatedR2Obj = await bucket.put(path, object.body, {
        httpMetadata: object.httpMetadata,
        customMetadata: Object.assign({}, object.customMetadata, { thumbnail: digest }),
      });
      if (object.customMetadata?.thumbnail) {
        // delete old thumbnail
        await bucket.delete(`${KEY_PREFIX_THUMBNAIL}${object.customMetadata.thumbnail}`);
      }
      if (env.DB) {
        try {
          await upsertDbFile(env.DB, updatedR2Obj);
        } catch (e) {
          /* empty */
        }
      }
    }
    return jsonResponse<ThumbnailObject>({ digest });
  }

  if (searchParams.has(UPLOAD_ID_VARIABLE)) {
    return handleRequestPutMultipart({ bucket, path, request, context, scope });
  }

  if (request.url.endsWith("/")) {
    return responseMethodNotAllowed();
  }

  // Check if the parent directory exists
  if (!path.startsWith(KEY_PREFIX_PRIVATE)) {
    const parentPath = dirname(path);
    const parentDir = parentPath === "" ? ROOT_OBJECT : await bucket.head(parentPath);
    if (parentDir === null || !isDirectory(parentDir)) {
      return responseConflict();
    }
  }

  const thumbnail = request.headers.get(HEADER_FD_THUMBNAIL);
  const comment = searchParams.get(COMMENT_VARIABLE);
  let customMetadata: Record<string, string> | undefined =
    comment || thumbnail
      ? {
          ...(comment && { comment }),
          ...(thumbnail && { thumbnail }),
        }
      : undefined;

  const oldObject = await bucket.head(path);

  if (checkConflict(request, oldObject)) {
    return responseConflict();
  }

  if (oldObject?.customMetadata?.thumbnail && (!thumbnail || oldObject.customMetadata.thumbnail !== thumbnail)) {
    await bucket.delete(`${KEY_PREFIX_THUMBNAIL}${oldObject.customMetadata.thumbnail}`);
  }

  if (request.headers.has(HEADER_SOURCE_URL)) {
    let sourceUrl = request.headers.get(HEADER_SOURCE_URL);
    if (!sourceUrl) {
      return responseBadRequest();
    }
    if (scope !== SCOPE_GLOBAL) {
      return responseForbidden();
    }
    let [contentType] = mimeType(request.headers.get(HEADER_CONTENT_TYPE));
    let sourceUrlOptions: RequestInit = {};
    if (request.headers.has(HEADER_SOURCE_URL_OPTIONS)) {
      sourceUrlOptions = JSON.parse(request.headers.get(HEADER_SOURCE_URL_OPTIONS)!);
    }
    let sourceReponse = await fetch(sourceUrl, sourceUrlOptions);
    // Follow up to 3 redirects
    for (let redirectCnt = 0; redirectCnt < 3; redirectCnt++) {
      if (sourceReponse.status !== 301 && sourceReponse.status !== 302) {
        break;
      }
      sourceUrl = validateAndGetSafeUrl(sourceReponse.headers.get(HEADER_LOCATION) || "");
      if (!sourceUrl) {
        return responseInternalServerError(`Source URL redirect without valid location header`);
      }
      sourceReponse = await fetch(sourceUrl, sourceUrlOptions);
    }
    if (!sourceReponse.ok) {
      if (sourceReponse.status === 304) {
        return responseNotModified();
      }
      return responseInternalServerError(`source url return status=${sourceReponse.status}`);
    }
    const contentLength = str2int(sourceReponse.headers.get(HEADER_CONTENT_LENGTH));
    if (!context.env.CLOUD_DOWNLOAD_UNLIMITED && contentLength > CLOUD_DOWNLOAD_SIZE_LIMIT) {
      return responseInternalServerError(`source url file is too large: ${humanReadableSize(contentLength)}`);
    }

    const [sourceContentType] = mimeType(sourceReponse.headers.get(HEADER_CONTENT_TYPE));
    if (contentType && sourceContentType && contentType !== sourceContentType) {
      return responseInternalServerError(`source url return different content-type ${sourceContentType}`);
    }
    contentType = contentType || sourceContentType || mime.getType(path) || MIME_DEFAULT;
    request.headers.set(HEADER_CONTENT_TYPE, contentType);
    let r2req: Promise<R2Object>;
    if (contentLength > 0) {
      // Provided readable stream must have a known length (Content-Length)
      r2req = bucket.put(path, sourceReponse.body, {
        httpMetadata: sourceReponse.headers,
        customMetadata,
      });
    } else {
      r2req = sourceReponse.blob().then((body) => {
        return bucket.put(path, body, {
          httpMetadata: sourceReponse.headers,
          customMetadata,
        });
      });
    }
    r2req = r2req.then((obj) => postUploadTasks(obj));
    if (str2int(request.headers.get(HEADER_SOURCE_ASYNC))) {
      context.waitUntil(r2req);
      return responseNoContent();
    }
    const r2obj = await r2req;
    return responseCreated(r2obj);
  }

  let body: ReadableStream | string | null = request.body;
  if (request.headers.get(HEADER_CONTENT_TYPE) == MIME_URL) {
    let url: string | null;
    if (searchParams.has(URL_VARIABLE)) {
      url = searchParams.get(URL_VARIABLE);
    } else {
      body = await request.text();
      url = parseUrlFile(body);
    }
    if (url) {
      url = validateAndGetSafeUrl(url);
    }
    if (url) {
      customMetadata = customMetadata ? { ...customMetadata, url } : { url };
    }
  }

  const result = await bucket.put(path, body, {
    onlyIf: request.headers,
    httpMetadata: request.headers,
    customMetadata,
    md5: searchParams.get(MD5_VARIABLE) || undefined,
  });

  if (!result) {
    return responsePreconditionsFailed();
  }
  await postUploadTasks(result);
  return responseCreated();

  /**
   * Handle post-upload tasks in best-effort way.
   * Return the same obj and never rejects.
   */
  async function postUploadTasks(obj: R2Object) {
    if (context.env.DB && !obj.key.startsWith(KEY_PREFIX_PRIVATE)) {
      try {
        await upsertDbFile(context.env.DB, obj);
      } catch (e) {
        console.log("failed to upsert file meta to db", e);
      }
    }
    if (context.env.IMAGES && !thumbnail && !request.headers.has(HEADER_NO_THUMBNAIL) && isImage(obj)) {
      try {
        await generateFileThumbnail({ images: context.env.IMAGES, bucket, key: obj.key });
      } catch (e) {
        console.log("failed to generate file thumbnail", e);
      }
    }
    return obj;
  }
}
