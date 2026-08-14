import { KEY_PREFIX_PRIVATE, KEY_PREFIX_THUMBNAIL } from "../../lib/commons";
import { isDirectory } from "../../lib/mime";
import { listAll, responseNoContent, responseNotFound } from "../commons";
import { deleteDbFile } from "../db";
import { RequestHandlerParams } from "./utils";

/**
 * delete key file from R2 bucket
 * @param bucket
 * @param key
 * @returns deleted file meta object or null if file does not exists
 */
export async function deleteFile(bucket: R2Bucket, key: string, keepThumbnail = false): Promise<R2Object | null> {
  let file = await bucket.head(key);
  if (!file && !key.endsWith("/")) {
    file = await bucket.head(key + "/");
    if (file) key = key + "/";
  } else if (!file && key.endsWith("/")) {
    file = await bucket.head(key.slice(0, -1));
    if (file) key = key.slice(0, -1);
  }
  if (!file) {
    return null;
  }
  if (!keepThumbnail && !key.startsWith(KEY_PREFIX_PRIVATE) && file.customMetadata?.thumbnail) {
    const thumbnailKey = `${KEY_PREFIX_THUMBNAIL}${file.customMetadata.thumbnail}`;
    const thumbnail = await bucket.get(thumbnailKey);
    if (thumbnail) {
      await bucket.delete(thumbnailKey);
    }
  }
  await bucket.delete(key);
  return file;
}

export async function handleRequestDelete({ bucket, path, context }: RequestHandlerParams, keepThumbnail = false) {
  if (path !== "") {
    const deletedObj = await deleteFile(bucket, path, keepThumbnail);
    if (context.env.DB) {
      try {
        await deleteDbFile(context.env.DB, path);
        if (path.endsWith("/")) {
          await deleteDbFile(context.env.DB, path.slice(0, -1));
        } else {
          await deleteDbFile(context.env.DB, path + "/");
        }
      } catch (e) {
        /* empty */
      }
    }
    if (deletedObj === null) {
      return responseNotFound();
    }
    if (!isDirectory(deletedObj)) {
      return responseNoContent();
    }
  }

  const prefix = path === "" ? undefined : path.endsWith("/") ? path : `${path}/`;
  const children = listAll(bucket, prefix, true);
  for await (const child of children) {
    if (child.key === path || (prefix && child.key === prefix)) {
      continue;
    }
    await deleteFile(bucket, child.key, keepThumbnail);
    if (context.env.DB) {
      try {
        await deleteDbFile(context.env.DB, child.key);
      } catch (e) {
        /* empty */
      }
    }
  }

  return responseNoContent();
}
