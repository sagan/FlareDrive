import pLimit from "p-limit";
import {
  HEADER_DEPTH,
  HEADER_DESTINATION,
  HEADER_OVERWRITE,
  KEY_PREFIX_PRIVATE,
  SYSFILES,
  WEBDAV_ENDPOINT,
  basename,
  dirname,
  isDirectory,
} from "../../lib/commons";
import {
  checkInvalidUserFileKey,
  listAll,
  responseBadRequest,
  responseConflict,
  responseCreated,
  responseForbidden,
  responseNoContent,
  responseNotFound,
  responsePreconditionsFailed,
} from "../commons";
import { RequestHandlerParams, ROOT_OBJECT } from "./utils";
import { upsertDbFile } from "../db";

export async function handleRequestCopy({ context, bucket, path, request, scope, authed }: RequestHandlerParams) {
  const dontOverwrite = request.headers.get(HEADER_OVERWRITE) === "F";
  const destinationHeader = request.headers.get(HEADER_DESTINATION);
  if (destinationHeader === null) {
    return responseBadRequest();
  }

  const src = await bucket.get(path);
  if (src === null) {
    return responseNotFound();
  }

  const destPathname = new URL(destinationHeader).pathname;
  const decodedPathname = decodeURIComponent(destPathname).replace(/\/$/, "");
  if (!decodedPathname.startsWith(WEBDAV_ENDPOINT)) {
    return responseBadRequest();
  }
  const destination = decodedPathname.slice(WEBDAV_ENDPOINT.length);
  if (!destination || destination === path || (isDirectory(src) && destination.startsWith(path + "/"))) {
    return responseBadRequest();
  }
  const invalidPathResponse = await checkInvalidUserFileKey(destination);
  if (invalidPathResponse) {
    return invalidPathResponse;
  }
  if ((scope && !destination.startsWith(scope + "/")) || (!authed && SYSFILES.includes(basename(destination)))) {
    return responseForbidden();
  }

  // Check if the destination already exists
  const destinationExists = await bucket.head(destination);
  if (dontOverwrite && destinationExists) {
    return responsePreconditionsFailed();
  }
  // Make sure destination parent dir exists.
  const destinationParent = dirname(destination);
  const destinationParentDir = destinationParent == "" ? ROOT_OBJECT : await bucket.head(destinationParent);
  if (destinationParentDir === null) {
    return responseConflict();
  }

  const obj = await bucket.put(destination, src.body, {
    httpMetadata: src.httpMetadata,
    customMetadata: src.customMetadata,
  });
  if (context.env.DB && !obj.key.startsWith(KEY_PREFIX_PRIVATE)) {
    try {
      await upsertDbFile(context.env.DB, obj);
    } catch (e) {
      console.log("failed to upsert file meta to db", e);
    }
  }

  if (isDirectory(src)) {
    const depth = request.headers.get(HEADER_DEPTH) ?? "infinity";
    switch (depth) {
      case "0":
        break;
      case "infinity": {
        const prefix = path + "/";
        const copy = async (object: R2Object) => {
          const target = `${destination}/${object.key.slice(prefix.length)}`;
          const src = await bucket.get(object.key);
          if (src === null) {
            return;
          }
          const obj = await bucket.put(target, src.body, {
            httpMetadata: object.httpMetadata,
            customMetadata: object.customMetadata,
          });
          if (context.env.DB && !obj.key.startsWith(KEY_PREFIX_PRIVATE)) {
            try {
              await upsertDbFile(context.env.DB, obj);
            } catch (e) {
              console.log("failed to upsert file meta to db", e);
            }
          }
        };
        const limit = pLimit(5);
        const promises = [];
        for await (const object of listAll(bucket, prefix, true)) {
          promises.push(limit(() => copy(object)));
        }
        await Promise.all(promises);
        break;
      }
      default:
        return responseBadRequest();
    }
  }

  if (destinationExists) {
    return responseNoContent();
  } else {
    return responseCreated();
  }
}
