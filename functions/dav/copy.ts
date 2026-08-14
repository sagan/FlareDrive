import pLimit from "p-limit";
import {
  HEADER_DEPTH,
  HEADER_DESTINATION,
  HEADER_OVERWRITE,
  KEY_PREFIX_PRIVATE,
  SCOPE_GLOBAL,
  SYSFILES,
  WEBDAV_ENDPOINT,
  ROOT_OBJECT,
  basename,
  dirname,
} from "../../lib/commons";
import { isDirectory } from "../../lib/mime";
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
import { RequestHandlerParams } from "./utils";
import { upsertDbFile } from "../db";

export async function handleRequestCopy({ context, bucket, path, request, scope, authed }: RequestHandlerParams) {
  const dontOverwrite = request.headers.get(HEADER_OVERWRITE) === "F";
  const destinationHeader = request.headers.get(HEADER_DESTINATION);
  if (destinationHeader === null) {
    return responseBadRequest();
  }

  let src = await bucket.get(path);
  if (src === null && !path.endsWith("/")) {
    src = await bucket.get(path + "/");
  } else if (src === null && path.endsWith("/")) {
    src = await bucket.get(path.slice(0, -1));
  }
  if (src === null) {
    return responseNotFound();
  }

  const destPathname = new URL(destinationHeader).pathname;
  const decodedPathname = decodeURIComponent(destPathname);
  if (!decodedPathname.startsWith(WEBDAV_ENDPOINT)) {
    return responseBadRequest();
  }
  const destination = decodedPathname.slice(WEBDAV_ENDPOINT.length);

  const srcPrefix = path === "" || path.endsWith("/") ? path : `${path}/`;
  const destPrefix = destination === "" || destination.endsWith("/") ? destination : `${destination}/`;

  if (
    !destination ||
    destination === path ||
    srcPrefix === destPrefix ||
    (isDirectory(src) && destPrefix.startsWith(srcPrefix))
  ) {
    return responseBadRequest();
  }
  const invalidPathResponse = await checkInvalidUserFileKey(destination);
  if (invalidPathResponse) {
    return invalidPathResponse;
  }
  if (
    (scope && scope !== SCOPE_GLOBAL && !destination.startsWith(scope + "/")) ||
    (!authed && (SYSFILES as readonly string[]).includes(basename(destination)))
  ) {
    return responseForbidden();
  }

  // Check if the destination already exists
  const destinationExists =
    (await bucket.head(destination)) ||
    (destination.endsWith("/") ? await bucket.head(destination.slice(0, -1)) : await bucket.head(destination + "/"));
  if (dontOverwrite && destinationExists) {
    return responsePreconditionsFailed();
  }
  // Make sure destination parent dir exists.
  const destinationParent = dirname(destination);
  const destinationParentDir =
    destinationParent === "" || destinationParent === "/"
      ? ROOT_OBJECT
      : (await bucket.head(destinationParent + "/")) || (await bucket.head(destinationParent));
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
        const copy = async (object: R2Object) => {
          if (object.key === srcPrefix || object.key === path) {
            return;
          }
          const subPath = object.key.slice(srcPrefix.length);
          const targetKey = `${destPrefix}${subPath}`;
          const childSrc = await bucket.get(object.key);
          if (childSrc === null) {
            return;
          }
          const childObj = await bucket.put(targetKey, childSrc.body, {
            httpMetadata: childSrc.httpMetadata,
            customMetadata: childSrc.customMetadata,
          });
          if (context.env.DB && !childObj.key.startsWith(KEY_PREFIX_PRIVATE)) {
            try {
              await upsertDbFile(context.env.DB, childObj);
            } catch (e) {
              console.log("failed to upsert file meta to db", e);
            }
          }
        };
        const limit = pLimit(5);
        const promises = [];
        for await (const object of listAll(bucket, srcPrefix, true)) {
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
