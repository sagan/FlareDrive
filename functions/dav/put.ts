import { HEADER_FD_THUMBNAIL } from "../../lib/commons";
import {
  responseBadRequest,
  responseConflict,
  responseCreated,
  responseMethodNotAllowed,
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
    headers: { "Content-Type": "application/json", etag: uploadedPart.etag },
  });
}

export async function handleRequestPut({ bucket, path, request }: RequestHandlerParams) {
  const searchParams = new URLSearchParams(new URL(request.url).search);
  if (searchParams.has("uploadId")) {
    return handleRequestPutMultipart({ bucket, path, request });
  }

  if (request.url.endsWith("/")) {
    return responseMethodNotAllowed();
  }

  // Check if the parent directory exists
  if (!path.startsWith("_$flaredrive$/")) {
    const parentPath = path.replace(/(\/|^)[^/]*$/, "");
    const parentDir = parentPath === "" ? ROOT_OBJECT : await bucket.head(parentPath);
    if (parentDir === null) {
      return responseConflict();
    }
  }

  const thumbnail = request.headers.get(HEADER_FD_THUMBNAIL);
  const customMetadata = thumbnail ? { thumbnail } : undefined;

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
