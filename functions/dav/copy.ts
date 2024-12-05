import pLimit from "p-limit";

import { WEBDAV_ENDPOINT } from "../../lib/commons";
import {
  responseBadRequest,
  responseConflict,
  responseCreated,
  responseNoContent,
  responseNotFound,
  responsePreconditionsFailed,
} from "../commons";
import { listAll, RequestHandlerParams, ROOT_OBJECT } from "./utils";

export async function handleRequestCopy({ bucket, path, request }: RequestHandlerParams) {
  const dontOverwrite = request.headers.get("Overwrite") === "F";
  const destinationHeader = request.headers.get("Destination");
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

  if (
    destination === path ||
    (src.httpMetadata?.contentType === "application/x-directory" && destination.startsWith(path + "/"))
  ) {
    return responseBadRequest();
  }

  // Check if the destination already exists
  const destinationExists = await bucket.head(destination);
  if (dontOverwrite && destinationExists) {
    return responsePreconditionsFailed();
  }
  // Make sure destination parent dir exists.
  const destinationParent = destination.replace(/(\/|^)[^/]*$/, "");
  const destinationParentDir = destinationParent === "" ? ROOT_OBJECT : await bucket.head(destinationParent);
  if (destinationParentDir === null) {
    return responseConflict();
  }

  await bucket.put(destination, src.body, {
    httpMetadata: src.httpMetadata,
    customMetadata: src.customMetadata,
  });

  const isDirectory = src.httpMetadata?.contentType === "application/x-directory";
  if (isDirectory) {
    const depth = request.headers.get("Depth") ?? "infinity";
    switch (depth) {
      case "0":
        break;
      case "infinity": {
        const prefix = path + "/";
        const copy = async (object: R2Object) => {
          const target = `${destination}/${object.key.slice(prefix.length)}`;
          const src = await bucket.get(object.key);
          if (src === null) return;
          await bucket.put(target, src.body, {
            httpMetadata: object.httpMetadata,
            customMetadata: object.customMetadata,
          });
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
