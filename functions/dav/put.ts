import mime from "mime";
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
  ThumbnailObject,
  humanReadableSize,
  mimeType,
  sha256,
  str2int,
} from "../../lib/commons";
import {
  checkConflict,
  jsonResponse,
  responseBadRequest,
  responseConflict,
  responseCreated,
  responseInternalServerError,
  responseMethodNotAllowed,
  responseNoContent,
  responseNotFound,
  responseNotModified,
  responsePreconditionsFailed,
} from "../commons";
import { RequestHandlerParams, ROOT_OBJECT } from "./utils";

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

  return new Response(null, {
    headers: { [HEADER_CONTENT_TYPE]: "application/json", etag: uploadedPart.etag },
  });
}

export async function handleRequestPut({ context, bucket, path, request, scope }: RequestHandlerParams) {
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
      await bucket.put(path, object.body, {
        httpMetadata: object.httpMetadata,
        customMetadata: Object.assign({}, object.customMetadata, { thumbnail: digest }),
      });
      if (object.customMetadata?.thumbnail) {
        // delete old thumbnail
        await bucket.delete(`${KEY_PREFIX_THUMBNAIL}${object.customMetadata.thumbnail}`);
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
    const parentPath = path.replace(/(\/|^)[^/]*$/, "");
    const parentDir = parentPath === "" ? ROOT_OBJECT : await bucket.head(parentPath);
    if (parentDir === null) {
      return responseConflict();
    }
  }

  const thumbnail = request.headers.get(HEADER_FD_THUMBNAIL);
  const customMetadata = thumbnail ? { thumbnail } : undefined;

  const oldObject = await bucket.head(path);

  if (checkConflict(request, oldObject)) {
    return responseConflict();
  }

  if (oldObject?.customMetadata?.thumbnail) {
    await bucket.delete(`${KEY_PREFIX_THUMBNAIL}${oldObject.customMetadata.thumbnail}`);
  }

  if (request.headers.has(HEADER_SOURCE_URL)) {
    const sourceUrl = request.headers.get(HEADER_SOURCE_URL);
    if (!sourceUrl) {
      return responseBadRequest();
    }
    let [contentType] = mimeType(request.headers.get(HEADER_CONTENT_TYPE));
    let sourceUrlOptions: any = {};
    if (request.headers.has(HEADER_SOURCE_URL_OPTIONS)) {
      sourceUrlOptions = JSON.parse(request.headers.get(HEADER_SOURCE_URL_OPTIONS)!);
    }
    const sourceReponse = await fetch(sourceUrl, sourceUrlOptions);
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
      r2req = new Promise((resolve) => {
        setTimeout(async () => {
          let body = await sourceReponse.blob();
          let obj = await bucket.put(path, body, {
            httpMetadata: sourceReponse.headers,
            customMetadata,
          });
          resolve(obj);
        }, 0);
      });
    }

    if (str2int(request.headers.get(HEADER_SOURCE_ASYNC))) {
      context.waitUntil(r2req);
      return responseNoContent();
    }
    const r2obj = await r2req;
    return responseCreated(r2obj);
  }

  const result = await bucket.put(path, request.body, {
    onlyIf: request.headers,
    httpMetadata: request.headers,
    customMetadata,
  });

  if (!result) {
    return responsePreconditionsFailed();
  }
  return responseCreated();
}
