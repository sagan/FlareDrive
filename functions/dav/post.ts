import {
  HEADER_FD_THUMBNAIL,
  HEADER_NO_THUMBNAIL,
  KEY_PREFIX_PRIVATE,
  MD5_VARIABLE,
  THUMBNAIL_VARIABLE,
  UPLOADS_VARIABLE,
  UPLOAD_ID_VARIABLE,
  isImage,
} from "../../lib/commons";
import {
  checkInvalidUserFileKey,
  generateFileThumbnail,
  responseBadRequest,
  responseMethodNotAllowed,
  responseNotFound,
} from "../commons";
import { upsertDbFile } from "../db";
import { RequestHandlerParams } from "./utils";

export async function handleRequestPostCreateMultipart({ bucket, path, request }: RequestHandlerParams) {
  const searchParams = new URLSearchParams(new URL(request.url).search);
  const thumbnail = request.headers.get(HEADER_FD_THUMBNAIL);
  const md5 = searchParams.get(MD5_VARIABLE);
  const customMetadata: Record<string, string> = {};
  if (md5) {
    customMetadata[MD5_VARIABLE] = md5;
  }
  if (thumbnail) {
    customMetadata[THUMBNAIL_VARIABLE] = thumbnail;
  }

  const multipartUpload = await bucket.createMultipartUpload(path, {
    httpMetadata: request.headers,
    customMetadata,
  });

  const { key, uploadId } = multipartUpload;
  return new Response(JSON.stringify({ key, uploadId }));
}

export async function handleRequestPostCompleteMultipart({ context, bucket, path, request }: RequestHandlerParams) {
  const url = new URL(request.url);
  const uploadId = new URLSearchParams(url.search).get(UPLOAD_ID_VARIABLE);
  if (!uploadId) {
    return responseNotFound();
  }
  const multipartUpload = bucket.resumeMultipartUpload(path, uploadId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completeBody = await request.json<{ parts: Array<any> }>();

  try {
    const object = await multipartUpload.complete(completeBody.parts);
    // generate thumbnail for uploaded file. Best effort
    if (context.env.IMAGES && !request.headers.has(HEADER_NO_THUMBNAIL) && isImage(object)) {
      try {
        await generateFileThumbnail({ images: context.env.IMAGES, bucket, key: object.key });
      } catch (e) {
        /* empty */
      }
    }
    if (context.env.DB && !object.key.startsWith(KEY_PREFIX_PRIVATE)) {
      try {
        await upsertDbFile(context.env.DB, object);
      } catch (e) {
        /* empty */
      }
    }
    return new Response(null, {
      headers: { etag: object.httpEtag },
    });
  } catch (err: unknown) {
    return responseBadRequest(`${err}}`);
  }
}

export const handleRequestPost = async function ({ bucket, path, request, context, scope }: RequestHandlerParams) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const invalidPathResponse = await checkInvalidUserFileKey(path);
  if (invalidPathResponse) {
    return invalidPathResponse;
  }

  if (searchParams.has(UPLOADS_VARIABLE)) {
    return handleRequestPostCreateMultipart({ bucket, path, request, context, scope });
  }

  if (searchParams.has(UPLOAD_ID_VARIABLE)) {
    return handleRequestPostCompleteMultipart({ bucket, path, request, context, scope });
  }

  return responseMethodNotAllowed();
};
