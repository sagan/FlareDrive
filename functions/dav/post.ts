import { HEADER_FD_THUMBNAIL } from "../../lib/commons";
import { responseBadRequest, responseMethodNotAllowed, responseNotFound } from "../commons";
import { RequestHandlerParams } from "./utils";

export async function handleRequestPostCreateMultipart({ bucket, path, request }: RequestHandlerParams) {
  const thumbnail = request.headers.get(HEADER_FD_THUMBNAIL);
  const customMetadata = thumbnail ? { thumbnail } : undefined;

  const multipartUpload = await bucket.createMultipartUpload(path, {
    httpMetadata: request.headers,
    customMetadata,
  });

  const { key, uploadId } = multipartUpload;
  return new Response(JSON.stringify({ key, uploadId }));
}

export async function handleRequestPostCompleteMultipart({ bucket, path, request }: RequestHandlerParams) {
  const url = new URL(request.url);
  const uploadId = new URLSearchParams(url.search).get("uploadId");
  if (!uploadId) {
    return responseNotFound();
  }
  const multipartUpload = bucket.resumeMultipartUpload(path, uploadId);

  const completeBody: { parts: Array<any> } = await request.json();

  try {
    const object = await multipartUpload.complete(completeBody.parts);
    return new Response(null, {
      headers: { etag: object.httpEtag },
    });
  } catch (error: any) {
    return responseBadRequest(error.message);
  }
}

export const handleRequestPost = async function ({ bucket, path, request }: RequestHandlerParams) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  if (searchParams.has("uploads")) {
    return handleRequestPostCreateMultipart({ bucket, path, request });
  }

  if (searchParams.has("uploadId")) {
    return handleRequestPostCompleteMultipart({ bucket, path, request });
  }

  return responseMethodNotAllowed();
};
