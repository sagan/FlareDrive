import { KEY_PREFIX_THUMBNAIL } from "../../lib/commons";
import { responseNotFound, responsePreconditionsFailed } from "../commons";
import { fallbackIconResponse } from "./icons";
import { RequestHandlerParams } from "./utils";

export async function handleRequestGet({ bucket, path, request }: RequestHandlerParams) {
  const obj = await bucket.get(path, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (obj === null) {
    if (path.startsWith(KEY_PREFIX_THUMBNAIL)) {
      return fallbackIconResponse(new URL(request.url).searchParams.get("ext") || "");
    }
    return responseNotFound();
  }
  if (!("body" in obj)) {
    return responsePreconditionsFailed();
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  if (path.startsWith(KEY_PREFIX_THUMBNAIL)) {
    headers.set("Cache-Control", "max-age=31536000");
  }
  return new Response(obj.body, { headers });
}
