import {
  DOWNLOAD_VARIABLE,
  KEY_PREFIX_THUMBNAIL,
  META_VARIABLE,
  THUMBNAIL_COLOR_VARIABLE,
  THUMBNAIL_CONTENT_TYPE,
  THUMBNAIL_NO404_VARIABLE,
  THUMBNAIL_NOFALLBACK,
  THUMBNAIL_VARIABLE,
  str2int,
} from "@/lib/commons";
import { jsonResponse, responseNotFound, responseNotModified, writeR2ObjectHeaders } from "../commons";
import { RequestHandlerParams } from "./utils";
import { fallbackIconResponse } from "../icons";

export async function handleRequestGet({ bucket, path, request, authed }: RequestHandlerParams) {
  const url = new URL(request.url);
  const searchParams = new URL(url).searchParams;
  const requestMeta = authed && !!str2int(searchParams.get(META_VARIABLE));

  if (str2int(searchParams.get(THUMBNAIL_VARIABLE))) {
    const obj = await bucket.head(path);
    const digest = obj?.customMetadata?.[THUMBNAIL_VARIABLE] || "";
    let thumbObj: R2ObjectBody | R2Object | null = null;
    if (digest) {
      if (requestMeta) {
        thumbObj = await bucket.head(KEY_PREFIX_THUMBNAIL + digest);
      } else {
        thumbObj = await bucket.get(KEY_PREFIX_THUMBNAIL + digest, {
          onlyIf: request.headers,
          range: request.headers,
        });
      }
    }
    if (requestMeta) {
      if (!thumbObj) {
        return responseNotFound();
      }
      return jsonResponse(thumbObj);
    }
    if (!thumbObj) {
      const noFallback = !!str2int(searchParams.get(THUMBNAIL_NOFALLBACK));
      if (noFallback) {
        return responseNotFound();
      }
      const color = searchParams.get(THUMBNAIL_COLOR_VARIABLE) || "";
      const no404 = !!str2int(searchParams.get(THUMBNAIL_NO404_VARIABLE));
      const contentType = searchParams.get(THUMBNAIL_CONTENT_TYPE);
      return fallbackIconResponse(path, contentType || obj?.httpMetadata?.contentType, color, no404);
    }
    if (!("body" in thumbObj)) {
      return responseNotModified();
    }
    const headers = new Headers();
    writeR2ObjectHeaders(thumbObj, headers);
    // headers.set("Cache-Control", "max-age=31536000");
    return new Response(thumbObj.body, { headers });
  }

  let obj: R2ObjectBody | R2Object | null;
  if (requestMeta) {
    obj = await bucket.head(path);
  } else {
    obj = await bucket.get(path, {
      onlyIf: request.headers,
      range: request.headers,
    });
  }
  if (obj === null) {
    return responseNotFound();
  }

  if (requestMeta) {
    return jsonResponse(obj);
  }
  if (!("body" in obj)) {
    return responseNotModified();
  }
  const headers = new Headers();
  writeR2ObjectHeaders(obj, headers);
  if (str2int(searchParams.get(DOWNLOAD_VARIABLE))) {
    headers.set("Content-Disposition", "attachment");
  }
  return new Response(obj.body, { headers });
}
