import { HEADER_FD_THUMBNAIL, UPLOADS_VARIABLE, UPLOAD_ID_VARIABLE } from "../../lib/commons";
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
  const uploadId = new URLSearchParams(url.search).get(UPLOAD_ID_VARIABLE);
  if (!uploadId) {
    return responseNotFound();
  }
  const multipartUpload = bucket.resumeMultipartUpload(path, uploadId);

  const completeBody = await request.json<{ parts: Array<any> }>();

  try {
    const object = await multipartUpload.complete(completeBody.parts);
    return new Response(null, {
      headers: { etag: object.httpEtag },
    });
  } catch (err: any) {
    return responseBadRequest(`${err.message || err}}`);
  }
}

export const handleRequestPost = async function ({ bucket, path, request, context, scope }: RequestHandlerParams) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  if (searchParams.has(UPLOADS_VARIABLE)) {
    return handleRequestPostCreateMultipart({ bucket, path, request, context, scope });
  }

  if (searchParams.has(UPLOAD_ID_VARIABLE)) {
    return handleRequestPostCompleteMultipart({ bucket, path, request, context, scope });
  }

  return responseMethodNotAllowed();
};
