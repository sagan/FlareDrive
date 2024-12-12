import { KEY_PREFIX_PRIVATE, KEY_PREFIX_THUMBNAIL, MIME_DIR, extname } from "../../lib/commons";
import { listAll, responseNoContent, responseNotFound } from "../commons";
import { RequestHandlerParams } from "./utils";

/**
 * delete key file from R2 bucket
 * @param bucket
 * @param key
 * @returns deleted file meta object or null if file does not exists
 */
export async function deleteFile(bucket: R2Bucket, key: string, keepThumbnail = false): Promise<R2Object | null> {
  const file = await bucket.head(key);
  if (!file) {
    return null;
  }
  if (!keepThumbnail && !key.startsWith(KEY_PREFIX_PRIVATE) && file.customMetadata?.thumbnail) {
    const thumbnailKey = `${KEY_PREFIX_THUMBNAIL}${file.customMetadata.thumbnail}${extname(key)}`;
    const thumbnail = await bucket.get(thumbnailKey);
    if (thumbnail) {
      await bucket.delete(thumbnailKey);
    }
  }
  await bucket.delete(key);
  return file;
}

export async function handleRequestDelete({ bucket, path }: RequestHandlerParams, keepThumbnail = false) {
  if (path !== "") {
    const deletedObj = await deleteFile(bucket, path, keepThumbnail);
    if (deletedObj === null) {
      return responseNotFound();
    }
    if (deletedObj.httpMetadata?.contentType !== MIME_DIR) {
      return responseNoContent();
    }
  }

  const children = listAll(bucket, path === "" ? undefined : `${path}/`);
  for await (const child of children) {
    await deleteFile(bucket, child.key, keepThumbnail);
  }

  return responseNoContent();
}
