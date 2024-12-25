import {
  HEADER_CONTENT_TYPE,
  HEADER_FD_THUMBNAIL,
  KEY_PREFIX_PRIVATE,
  KEY_PREFIX_THUMBNAIL,
  THUMBNAIL_VARIABLE,
  ThumbnailObject,
  sha256,
  str2int,
} from "../../lib/commons";
import {
  jsonResponse,
  responseBadRequest,
  responseConflict,
  responseCreated,
  responseMethodNotAllowed,
  responseNoContent,
  responseNotFound,
  responsePreconditionsFailed,
} from "../commons";
import { RequestHandlerParams, ROOT_OBJECT } from "./utils";

async function handleRequestPutMultipart({ bucket, path, request }: RequestHandlerParams) {
  const url = new URL(request.url);

  const uploadId = new URLSearchParams(url.search).get("uploadId");
  const partNumberStr = new URLSearchParams(url.search).get("partNumber");
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

export async function handleRequestPut({ bucket, path, request }: RequestHandlerParams) {
  const searchParams = new URLSearchParams(new URL(request.url).search);

  if (str2int(searchParams.get(THUMBNAIL_VARIABLE))) {
    // request is to update object's thumbnail.
    // return created thumbnail R2Object json when success.
    const object = await bucket.get(path);
    if (!object) {
      return responseNotFound();
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
    await bucket.put(path, object.body, {
      httpMetadata: object.httpMetadata,
      customMetadata: Object.assign({}, object.customMetadata, { thumbnail: digest }),
    });
    if (object.customMetadata?.thumbnail) {
      // delete old thumbnail
      await bucket.delete(`${KEY_PREFIX_THUMBNAIL}${object.customMetadata.thumbnail}`);
    }
    return jsonResponse<ThumbnailObject>({ digest });
  }

  if (searchParams.has("uploadId")) {
    return handleRequestPutMultipart({ bucket, path, request });
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

  if (oldObject?.customMetadata?.thumbnail) {
    await bucket.delete(`${KEY_PREFIX_THUMBNAIL}${oldObject.customMetadata.thumbnail}`);
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
