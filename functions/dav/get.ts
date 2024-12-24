import {
  DOWNLOAD_VARIABLE,
  HEADER_AUTHED,
  KEY_PREFIX_THUMBNAIL,
  THUMBNAIL_COLOR_VARIABLE,
  THUMBNAIL_NO404_VARIABLE,
  THUMBNAIL_VARIABLE,
  str2int,
} from "@/lib/commons";
import { responseNotFound, responsePreconditionsFailed } from "../commons";
import { RequestHandlerParams } from "./utils";
import { fallbackIconResponse } from "./icons";

export async function handleRequestGet({ bucket, path, request }: RequestHandlerParams) {
  const obj = await bucket.get(path, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (obj === null) {
    return responseNotFound();
  }
  const searchParams = new URL(request.url).searchParams;
  if (str2int(searchParams.get(THUMBNAIL_VARIABLE))) {
    const digest = obj.customMetadata?.[THUMBNAIL_VARIABLE];
    let thumbObj: R2ObjectBody | R2Object | null = null;
    if (digest) {
      thumbObj = await bucket.get(KEY_PREFIX_THUMBNAIL + digest, {
        onlyIf: request.headers,
        range: request.headers,
      });
    }
    if (!thumbObj) {
      const color = searchParams.get(THUMBNAIL_COLOR_VARIABLE) || "";
      const no404 = !!str2int(searchParams.get(THUMBNAIL_NO404_VARIABLE));
      return fallbackIconResponse(path, color, no404);
    }
    if (!("body" in thumbObj)) {
      return responsePreconditionsFailed();
    }
    const headers = new Headers();
    headers.set("Cache-Control", "max-age=31536000");
    thumbObj.writeHttpMetadata(headers);
    return new Response(thumbObj.body, { headers });
  }
  if (!("body" in obj)) {
    return responsePreconditionsFailed();
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  if (str2int(searchParams.get(DOWNLOAD_VARIABLE))) {
    headers.set("Content-Disposition", "attachment");
  }
  return new Response(obj.body, { headers });
}
