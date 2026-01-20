import { HEADER_DIR_EXISTS, KEY_PREFIX_PRIVATE, MIME_DIR, dirname, isDirectory } from "../../lib/commons";
import { checkInvalidUserFileKey, responseConflict, responseCreated, responseMethodNotAllowed } from "../commons";
import { upsertDbFile } from "../db";
import { RequestHandlerParams, ROOT_OBJECT } from "./utils";

export async function handleRequestMkcol({ bucket, context, path }: RequestHandlerParams) {
  if (!path.endsWith("/")) {
    path += "/";
  }
  // Check if the resource already exists
  const resource = await bucket.head(path);
  if (resource) {
    return responseMethodNotAllowed("", isDirectory(resource) ? { [HEADER_DIR_EXISTS]: "1" } : undefined);
  }
  const invalidPathResponse = await checkInvalidUserFileKey(path);
  if (invalidPathResponse) {
    return invalidPathResponse;
  }

  // Check if the parent directory exists
  const parentPath = dirname(path);
  const parentDir = parentPath === "" ? ROOT_OBJECT : await bucket.head(parentPath);
  if (parentDir === null) {
    return responseConflict();
  }

  const obj = await bucket.put(path, "", {
    httpMetadata: { contentType: MIME_DIR },
  });
  if (context.env.DB && !obj.key.startsWith(KEY_PREFIX_PRIVATE)) {
    try {
      await upsertDbFile(context.env.DB, obj);
    } catch (e) {
      console.log("failed to upsert dir meta to db", e);
    }
  }

  return responseCreated();
}
